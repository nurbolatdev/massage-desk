package com.massagedesk.api.bot;

import static com.massagedesk.api.bot.BotConversations.bot;
import static com.massagedesk.api.bot.BotConversations.buttonIds;
import static com.massagedesk.api.bot.BotConversations.cleanUp;
import static com.massagedesk.api.bot.BotConversations.clientIdOf;
import static com.massagedesk.api.bot.BotConversations.conversation;
import static com.massagedesk.api.bot.BotConversations.reply;
import static com.massagedesk.api.bot.BotConversations.requestJson;
import static com.massagedesk.api.bot.BotConversations.rowIds;
import static com.massagedesk.api.bot.BotConversations.text;
import static com.massagedesk.api.messaging.TestOutboundMessages.MESSAGES_URL;
import static com.massagedesk.api.messaging.TestOutboundMessages.accepted;
import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.Appointment;
import com.massagedesk.api.booking.AppointmentRepository;
import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.booking.AppointmentStatus;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.TestOutboundMessages;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.SlotService;
import com.massagedesk.api.schedule.TimeRange;
import com.massagedesk.api.schedule.WorkingHours;
import com.massagedesk.api.schedule.WorkingHoursRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class BookingBotCancelTests {

    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 3);
    private static final Instant START = Instant.parse("2026-11-03T05:00:00Z");
    private static final Instant PAST_START = Instant.parse("2026-11-02T03:00:00Z");
    private static final String CONFIRMATION_TEXT =
            "Отменить запись?\nКлассический массаж\nВторник, 3 ноября, 10:00";
    private static final String CANCELLED_TEXT =
            "Запись отменена:\nКлассический массаж\nВторник, 3 ноября, 10:00";

    @Autowired private ApplicationContext context;
    @Autowired private BotSessionStore sessions;
    @Autowired private AppointmentService appointments;
    @Autowired private AppointmentRepository appointmentRepository;
    @Autowired private SlotService slots;
    @Autowired private MassageServiceRepository serviceRepository;
    @Autowired private WorkingHoursRepository workingHoursRepository;
    @Autowired private ClientRepository clients;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JdbcClient jdbcClient;
    @Autowired private Clock clock;
    @Autowired private JsonMapper json;

    private MockRestServiceServer server;
    private BookingBot bot;
    private MassageService service;
    private UUID serviceId;
    private UUID hoursId;

    @BeforeEach
    void setUp() {
        cleanUp(jdbc);
        hoursId = workingHoursRepository
                .saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)))
                .getId();
        service = serviceRepository
                .saveAndFlush(new MassageService("Классический массаж", 60, new BigDecimal("8000.00"), 1));
        serviceId = service.getId();
        configureBot(false);
    }

    @AfterEach
    void tearDown() {
        cleanUp(jdbc);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from working_hours where id = ?", hoursId);
    }

    @Test
    void pickOwnAppointmentMovesToCancelConfirmAndConfirmCancelsOnceAndFreesSlot() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        UUID clientId = clientIdOf(jdbc, id);
        UUID appointmentId = appointments
                .create(clientId, serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        assertThat(slots.freeStarts(serviceId, TUESDAY).orElseThrow().starts())
                .doesNotContain(START);

        sessions.save(
                id,
                new BotSession(Step.CANCEL_PICK, null, null, null, null),
                NOW.minus(Duration.ofMinutes(1)));

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo(CONFIRMATION_TEXT);
                    assertThat(buttonIds(body))
                            .containsExactly("cancel_confirm:" + appointmentId, "keep");
                })
                .andRespond(withSuccess(accepted("wamid.bot-cancel-confirm"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo(CANCELLED_TEXT);
                    assertThat(buttonIds(body)).containsExactly("book");
                })
                .andRespond(withSuccess(accepted("wamid.bot-cancelled"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo(BotReplies.MENU_TEXT);
                    assertThat(buttonIds(body)).containsExactly("book");
                })
                .andRespond(withSuccess(accepted("wamid.bot-cancel-repeat-menu"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "appointment:" + appointmentId));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.CANCEL_CONFIRM, null, null, null, appointmentId));
        assertThat(appointmentRepository.findById(appointmentId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);

        bot.on(reply(jdbc, id, "cancel_confirm:" + appointmentId));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentRepository.findById(appointmentId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CANCELLED);
        assertThat(botCancelledEventsCount(appointmentId)).isEqualTo(1);
        assertThat(slots.freeStarts(serviceId, TUESDAY).orElseThrow().starts())
                .contains(START);

        bot.on(reply(jdbc, id, "cancel_confirm:" + appointmentId));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(botCancelledEventsCount(appointmentId)).isEqualTo(1);
    }

    @Test
    void keepReturnsToMenuWithAppointmentAndMismatchedButtonOrFreeTextRepeatsConfirmation() {
        UUID id = conversation(clients, jdbc, "+998900001202");
        UUID clientId = clientIdOf(jdbc, id);
        UUID appointmentId = appointments
                .create(clientId, serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        UUID otherAppointmentId = UUID.fromString("00000000-0000-0000-0000-000000000099");
        BotSession confirmSession =
                new BotSession(Step.CANCEL_CONFIRM, null, null, null, appointmentId);
        sessions.save(id, confirmSession, NOW.minus(Duration.ofMinutes(1)));

        for (int attempt = 1; attempt <= 2; attempt++) {
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(interactiveBodyOf(body)).isEqualTo(CONFIRMATION_TEXT);
                        assertThat(buttonIds(body))
                                .containsExactly("cancel_confirm:" + appointmentId, "keep");
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-cancel-repeat-" + attempt), APPLICATION_JSON));
        }
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body))
                            .contains("Ваши записи:\nВторник, 3 ноября, 10:00 — Классический массаж");
                    assertThat(buttonIds(body)).containsExactly("book", "cancel");
                })
                .andRespond(withSuccess(accepted("wamid.bot-cancel-keep"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "cancel_confirm:" + otherAppointmentId));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(confirmSession);
        assertThat(appointmentRepository.findById(appointmentId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);

        bot.on(text(jdbc, id, "да"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(confirmSession);
        assertThat(appointmentRepository.findById(appointmentId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);

        bot.on(reply(jdbc, id, "keep"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentRepository.findById(appointmentId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(botCancelledEventsCount(appointmentId)).isZero();
    }

    @Test
    void alreadyCancelledByMasterForeignOrPastAppointmentInSessionSendsGoneAndMenuWithoutCancelling() {
        UUID id = conversation(clients, jdbc, "+998900001203");
        UUID clientId = clientIdOf(jdbc, id);
        Client client = clients.findById(clientId).orElseThrow();
        Client other = clients.saveAndFlush(new Client("+998900001208", "Other client"));

        UUID cancelledByMasterId = appointments
                .create(clientId, serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        appointments.cancel(cancelledByMasterId, EventActor.MASTER);

        UUID foreignId = appointments
                .create(
                        other.getId(),
                        serviceId,
                        Instant.parse("2026-11-03T08:00:00Z"),
                        AppointmentSource.MANUAL,
                        EventActor.MASTER)
                .id();

        Appointment past = new Appointment(
                client,
                service,
                new TimeRange(PAST_START, PAST_START.plus(Duration.ofHours(1))),
                AppointmentSource.MANUAL);
        UUID pastId = appointmentRepository.saveAndFlush(past).getId();

        for (int attempt = 1; attempt <= 3; attempt++) {
            int currentAttempt = attempt;
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(body.path("type").asString()).isEqualTo("text");
                        assertThat(textOf(body)).isEqualTo(BotReplies.GONE_TEXT);
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-cancel-gone-text-" + currentAttempt),
                            APPLICATION_JSON));
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(interactiveBodyOf(body)).isEqualTo(BotReplies.MENU_TEXT);
                        assertThat(buttonIds(body)).containsExactly("book");
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-cancel-gone-menu-" + currentAttempt),
                            APPLICATION_JSON));
        }

        sessions.save(
                id,
                new BotSession(Step.CANCEL_CONFIRM, null, null, null, cancelledByMasterId),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "cancel_confirm:" + cancelledByMasterId));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(botCancelledEventsCount(cancelledByMasterId)).isZero();

        sessions.save(
                id,
                new BotSession(Step.CANCEL_CONFIRM, null, null, null, foreignId),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "cancel_confirm:" + foreignId));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentRepository.findById(foreignId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(cancelledEventsCount(foreignId)).isZero();

        sessions.save(
                id,
                new BotSession(Step.CANCEL_CONFIRM, null, null, null, pastId),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "cancel_confirm:" + pastId));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentRepository.findById(pastId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(cancelledEventsCount(pastId)).isZero();
    }

    @Test
    void bookButtonOnCancelConfirmOpensServiceListWithoutCancelling() {
        UUID id = conversation(clients, jdbc, "+998900001205");
        UUID appointmentId = appointments
                .create(clientIdOf(jdbc, id), serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        sessions.save(
                id,
                new BotSession(Step.CANCEL_CONFIRM, null, null, null, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .contains("service:" + serviceId))
                .andRespond(withSuccess(accepted("wamid.bot-confirm-book"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "book"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session().step()).isEqualTo(Step.SERVICE);
        assertThat(appointmentRepository.findById(appointmentId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(cancelledEventsCount(appointmentId)).isZero();
    }

    @RepeatedTest(5)
    void concurrentCancelConfirmTapsCancelOnceAndNeverSendGoneText() throws Exception {
        configureBot(true);
        UUID id = conversation(clients, jdbc, "+998900001204");
        UUID clientId = clientIdOf(jdbc, id);
        UUID appointmentId = appointments
                .create(clientId, serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        sessions.save(
                id,
                new BotSession(Step.CANCEL_CONFIRM, null, null, null, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));

        AtomicInteger sequence = new AtomicInteger();
        Queue<JsonNode> bodies = new ConcurrentLinkedQueue<>();
        server.expect(ExpectedCount.between(1, 2), requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> bodies.add(requestJson(json, request)))
                .andRespond(request -> withSuccess(
                                accepted("wamid.bot-cancel-concurrent-" + sequence.incrementAndGet()),
                                APPLICATION_JSON)
                        .createResponse(request));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);
            List<Future<?>> futures = new ArrayList<>(2);
            for (int i = 0; i < 2; i++) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await();
                    bot.on(reply(jdbc, id, "cancel_confirm:" + appointmentId));
                    return null;
                }));
            }
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<?> future : futures) {
                future.get(30, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        server.verify();
        assertThat(bodies).hasSizeBetween(1, 2);
        assertThat(bodies)
                .filteredOn(body -> CANCELLED_TEXT.equals(interactiveBodyOf(body)))
                .hasSize(1)
                .first()
                .satisfies(body -> assertThat(buttonIds(body)).containsExactly("book"));
        assertThat(bodies)
                .filteredOn(body -> !CANCELLED_TEXT.equals(interactiveBodyOf(body)))
                .allSatisfy(body -> {
                    assertThat(interactiveBodyOf(body)).startsWith(BotReplies.MENU_TEXT);
                    assertThat(buttonIds(body)).contains("book");
                });
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentRepository.findById(appointmentId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CANCELLED);
        assertThat(botCancelledEventsCount(appointmentId)).isEqualTo(1);
    }

    private static String textOf(JsonNode body) {
        return body.path("text").path("body").asString("");
    }

    private static String interactiveBodyOf(JsonNode body) {
        return body.path("interactive").path("body").path("text").asString("");
    }

    private void configureBot(boolean ignoreExpectOrder) {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).ignoreExpectOrder(ignoreExpectOrder).build();
        bot = bot(context, TestOutboundMessages.create(jdbcClient, builder, json, clock));
    }

    private int botCancelledEventsCount(UUID appointmentId) {
        return jdbc.queryForObject(
                """
                select count(*) from events
                where type = 'appointment_cancelled'
                  and actor = 'bot'
                  and entity_id = ?""",
                Integer.class,
                appointmentId);
    }

    private int cancelledEventsCount(UUID appointmentId) {
        return jdbc.queryForObject(
                """
                select count(*) from events
                where type = 'appointment_cancelled'
                  and entity_id = ?""",
                Integer.class,
                appointmentId);
    }
}
