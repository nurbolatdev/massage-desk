package com.massagedesk.api.bot;

import static com.massagedesk.api.bot.BotConversations.bot;
import static com.massagedesk.api.bot.BotConversations.buttonIds;
import static com.massagedesk.api.bot.BotConversations.cleanUp;
import static com.massagedesk.api.bot.BotConversations.clientIdOf;
import static com.massagedesk.api.bot.BotConversations.conversation;
import static com.massagedesk.api.bot.BotConversations.messagesOf;
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
import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.bot.BotConversations.StoredMessage;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.TestOutboundMessages;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.WorkingHours;
import com.massagedesk.api.schedule.WorkingHoursRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
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
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
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
class BookingBotRescheduleConversationTests {

    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 3);
    private static final Instant START_10_00 = Instant.parse("2026-11-03T05:00:00Z");
    private static final Instant END_11_00 = Instant.parse("2026-11-03T06:00:00Z");
    private static final Instant START_12_00 = Instant.parse("2026-11-03T07:00:00Z");
    private static final Instant END_13_00 = Instant.parse("2026-11-03T08:00:00Z");
    private static final Instant START_14_00 = Instant.parse("2026-11-03T09:00:00Z");
    private static final Instant END_15_00 = Instant.parse("2026-11-03T10:00:00Z");
    private static final String CONFIRM_14_00_TEXT = """
            Перенести запись?
            Классический массаж
            Сейчас: Вторник, 3 ноября, 10:00
            Новое время: Вторник, 3 ноября, 14:00""";
    private static final String MOVED_14_00_TEXT = """
            Запись перенесена:
            Классический массаж
            Вторник, 3 ноября, 14:00
            Ждём вас!""";
    private static final String MOVED_12_00_TEXT = """
            Запись перенесена:
            Классический массаж
            Вторник, 3 ноября, 12:00
            Ждём вас!""";

    private record StoredAppointment(Instant startAt, Instant endAt, String source, String status) {}

    private record StoredEvent(String type, String actor) {}

    @Autowired private ApplicationContext context;
    @Autowired private BotSessionStore sessions;
    @Autowired private AppointmentService appointments;
    @Autowired private MassageServiceRepository serviceRepository;
    @Autowired private WorkingHoursRepository workingHoursRepository;
    @Autowired private ClientRepository clients;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JdbcClient jdbcClient;
    @Autowired private Clock clock;
    @Autowired private JsonMapper json;

    private MockRestServiceServer server;
    private BookingBot bot;
    private UUID serviceId;
    private UUID hoursId;

    @BeforeEach
    void setUp() {
        cleanUp(jdbc);
        hoursId = workingHoursRepository
                .saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)))
                .getId();
        serviceId = serviceRepository
                .saveAndFlush(new MassageService("Классический массаж", 60, new BigDecimal("8000.00"), 1))
                .getId();
        configureBot(false);
    }

    @AfterEach
    void tearDown() {
        cleanUp(jdbc);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from working_hours where id = ?", hoursId);
    }

    @Test
    void fullConversationFromMenuToRescheduledAppointmentAndUpdatedMenu() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        UUID clientId = clientIdOf(jdbc, id);
        UUID appointmentId = appointments
                .create(clientId, serviceId, START_10_00, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        AtomicReference<String> nextReplyId = new AtomicReference<>();

        expectReply(1, body -> {
            assertThat(interactiveBodyOf(body))
                    .contains("Ваши записи:\nВторник, 3 ноября, 10:00 — Классический массаж");
            assertThat(buttonIds(body)).containsExactly("book", "move", "cancel");
            nextReplyId.set(pick(buttonIds(body), "move"));
        });
        expectReply(2, body -> {
            assertThat(interactiveBodyOf(body)).isEqualTo(BotReplies.MOVE_PICK_TEXT);
            assertThat(rowIds(body)).containsExactly("appointment:" + appointmentId);
            nextReplyId.set(rowIds(body).get(0));
        });
        expectReply(3, body -> {
            assertThat(interactiveBodyOf(body)).isEqualTo("Выберите день.");
            assertThat(rowIds(body)).first().isEqualTo("day:2026-11-03");
            nextReplyId.set(pick(rowIds(body), "day:2026-11-03"));
        });
        expectReply(4, body -> {
            assertThat(interactiveBodyOf(body)).isEqualTo("Вторник, 3 ноября. Выберите время.");
            assertThat(rowIds(body))
                    .doesNotContain("time:2026-11-03T05:00:00Z")
                    .contains("time:2026-11-03T09:00:00Z");
            nextReplyId.set(pick(rowIds(body), "time:2026-11-03T09:00:00Z"));
        });
        expectReply(5, body -> {
            assertThat(interactiveBodyOf(body)).isEqualTo(CONFIRM_14_00_TEXT);
            assertThat(buttonIds(body))
                    .containsExactly(
                            "move_confirm:" + appointmentId + ":2026-11-03T09:00:00Z", "other_time");
            nextReplyId.set(buttonIds(body).get(0));
        });
        expectReply(6, body -> {
            assertThat(body.path("type").asString()).isEqualTo("text");
            assertThat(textOf(body)).isEqualTo(MOVED_14_00_TEXT);
        });
        expectReply(7, body -> {
            assertThat(interactiveBodyOf(body))
                    .contains("Ваши записи:\nВторник, 3 ноября, 14:00 — Классический массаж")
                    .doesNotContain("10:00");
            assertThat(buttonIds(body)).containsExactly("book", "move", "cancel");
        });

        bot.on(text(jdbc, id, "Здравствуйте"));
        for (int turn = 0; turn < 5; turn++) {
            String replyId = nextReplyId.getAndSet(null);
            assertThat(replyId).isNotNull();
            bot.on(reply(jdbc, id, replyId));
        }
        bot.on(text(jdbc, id, "Здравствуйте"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentsOf(clientId))
                .containsExactly(new StoredAppointment(START_14_00, END_15_00, "manual", "confirmed"));
        assertThat(eventsOfAppointment(appointmentId))
                .containsExactly(
                        new StoredEvent("appointment_created", "master"),
                        new StoredEvent("appointment_rescheduled", "bot"));
        List<StoredMessage> messages = messagesOf(jdbc, id);
        assertThat(messages).hasSize(7).allSatisfy(m -> {
            assertThat(m.direction()).isEqualTo("out");
            assertThat(m.author()).isEqualTo("bot");
            assertThat(m.body()).isNotBlank();
        });
    }

    @Test
    void secondClientCannotSeeOrRescheduleFirstClientsAppointment() {
        UUID conversationA = conversation(clients, jdbc, "+998900001202");
        UUID conversationB = conversation(clients, jdbc, "+998900001203");
        UUID clientA = clientIdOf(jdbc, conversationA);
        UUID clientB = clientIdOf(jdbc, conversationB);
        UUID appointmentA = appointments
                .create(clientA, serviceId, START_10_00, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        UUID appointmentB = appointments
                .create(clientB, serviceId, START_14_00, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();

        for (int step = 1; step <= 2; step++) {
            expectReply(step, body -> {
                assertThat(interactiveBodyOf(body)).isEqualTo(BotReplies.MOVE_PICK_TEXT);
                assertThat(rowIds(body))
                        .containsExactly("appointment:" + appointmentB)
                        .doesNotContain("appointment:" + appointmentA);
            });
        }
        expectGoneAndClientBMenu(3);
        expectGoneAndClientBMenu(5);

        bot.on(reply(jdbc, conversationB, "move"));
        assertThat(sessions.load(conversationB).orElseThrow().session().step())
                .isEqualTo(Step.MOVE_PICK);

        bot.on(reply(jdbc, conversationB, "appointment:" + appointmentA));
        assertThat(sessions.load(conversationB).orElseThrow().session().step())
                .isEqualTo(Step.MOVE_PICK);

        sessions.save(
                conversationB,
                new BotSession(Step.TIME, null, TUESDAY, null, appointmentA),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, conversationB, "time:2026-11-03T07:00:00Z"));
        assertThat(sessions.load(conversationB).orElseThrow().session()).isEqualTo(BotSession.menu());

        sessions.save(
                conversationB,
                new BotSession(Step.CONFIRM, null, TUESDAY, START_12_00, appointmentA),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, conversationB, "move_confirm:" + appointmentA + ":2026-11-03T07:00:00Z"));

        server.verify();
        assertThat(sessions.load(conversationB).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentsOf(clientA))
                .containsExactly(new StoredAppointment(START_10_00, END_11_00, "manual", "confirmed"));
        assertThat(appointmentsOf(clientB))
                .containsExactly(new StoredAppointment(START_14_00, END_15_00, "manual", "confirmed"));
        assertThat(eventsOfAppointment(appointmentA))
                .containsExactly(new StoredEvent("appointment_created", "master"));
    }

    @RepeatedTest(5)
    void concurrentMoveConfirmTapsRescheduleOnceAndNeverSendTimeTakenOrGoneText() throws Exception {
        configureBot(true);
        UUID id = conversation(clients, jdbc, "+998900001204");
        UUID clientId = clientIdOf(jdbc, id);
        UUID appointmentId = appointments
                .create(clientId, serviceId, START_10_00, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        sessions.save(
                id,
                new BotSession(Step.CONFIRM, null, TUESDAY, START_12_00, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));
        String confirmReplyId = "move_confirm:" + appointmentId + ":2026-11-03T07:00:00Z";

        AtomicInteger sequence = new AtomicInteger();
        Queue<JsonNode> bodies = new ConcurrentLinkedQueue<>();
        server.expect(ExpectedCount.between(1, 2), requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> bodies.add(requestJson(json, request)))
                .andRespond(request -> withSuccess(
                                accepted("wamid.bot-move-concurrent-" + sequence.incrementAndGet()),
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
                    bot.on(reply(jdbc, id, confirmReplyId));
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
        assertThat(bodies)
                .hasSizeBetween(1, 2)
                .noneSatisfy(body -> assertThat(textOf(body)).isEqualTo(BotReplies.TIME_TAKEN_TEXT))
                .noneSatisfy(body -> assertThat(textOf(body)).isEqualTo(BotReplies.GONE_TEXT));
        assertThat(bodies)
                .filteredOn(body -> MOVED_12_00_TEXT.equals(textOf(body)))
                .hasSize(1);
        assertThat(bodies)
                .filteredOn(body -> !MOVED_12_00_TEXT.equals(textOf(body)))
                .allSatisfy(body -> {
                    assertThat(interactiveBodyOf(body)).startsWith(BotReplies.MENU_TEXT);
                    assertThat(buttonIds(body)).containsExactly("book", "move", "cancel");
                });
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentsOf(clientId))
                .containsExactly(new StoredAppointment(START_12_00, END_13_00, "manual", "confirmed"));
        assertThat(eventsOfAppointment(appointmentId))
                .containsExactly(
                        new StoredEvent("appointment_created", "master"),
                        new StoredEvent("appointment_rescheduled", "bot"));
    }

    private static String pick(List<String> ids, String expected) {
        assertThat(ids).contains(expected);
        return ids.get(ids.indexOf(expected));
    }

    private static String textOf(JsonNode body) {
        return body.path("text").path("body").asString("");
    }

    private static String interactiveBodyOf(JsonNode body) {
        return body.path("interactive").path("body").path("text").asString("");
    }

    private void expectReply(int step, Consumer<JsonNode> assertion) {
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertion.accept(requestJson(json, request)))
                .andRespond(withSuccess(accepted("wamid.bot-move-conv-" + step), APPLICATION_JSON));
    }

    private void expectGoneAndClientBMenu(int step) {
        expectReply(step, body -> {
            assertThat(body.path("type").asString()).isEqualTo("text");
            assertThat(textOf(body)).isEqualTo(BotReplies.GONE_TEXT);
        });
        expectReply(step + 1, body -> {
            assertThat(interactiveBodyOf(body))
                    .contains("Ваши записи:\nВторник, 3 ноября, 14:00 — Классический массаж")
                    .doesNotContain("10:00");
            assertThat(buttonIds(body)).containsExactly("book", "move", "cancel");
        });
    }

    private void configureBot(boolean ignoreExpectOrder) {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).ignoreExpectOrder(ignoreExpectOrder).build();
        bot = bot(context, TestOutboundMessages.create(jdbcClient, builder, json, clock));
    }

    private List<StoredAppointment> appointmentsOf(UUID clientId) {
        return jdbc.query(
                "select lower(period) as start_at, upper(period) as end_at, source, status from appointments where client_id = ?",
                (rs, rowNum) -> new StoredAppointment(
                        rs.getObject("start_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("end_at", OffsetDateTime.class).toInstant(),
                        rs.getString("source"),
                        rs.getString("status")),
                clientId);
    }

    private List<StoredEvent> eventsOfAppointment(UUID appointmentId) {
        return jdbc.query(
                "select type, actor from events where entity_id = ? order by created_at, id",
                (rs, rowNum) -> new StoredEvent(rs.getString("type"), rs.getString("actor")),
                appointmentId);
    }
}
