package com.massagedesk.api.bot;

import static com.massagedesk.api.bot.BotConversations.bot;
import static com.massagedesk.api.bot.BotConversations.buttonIds;
import static com.massagedesk.api.bot.BotConversations.cleanUp;
import static com.massagedesk.api.bot.BotConversations.clientIdOf;
import static com.massagedesk.api.bot.BotConversations.conversation;
import static com.massagedesk.api.bot.BotConversations.reply;
import static com.massagedesk.api.bot.BotConversations.requestJson;
import static com.massagedesk.api.bot.BotConversations.rowIds;
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
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class BookingBotRescheduleTests {

    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 3);
    private static final Instant START = Instant.parse("2026-11-03T05:00:00Z");
    private static final Instant NEW_START = Instant.parse("2026-11-03T07:00:00Z");
    private static final Instant NEW_END = Instant.parse("2026-11-03T08:00:00Z");
    private static final Instant PAST_START = Instant.parse("2026-11-02T03:00:00Z");
    private static final String MOVED_TEXT = """
            Запись перенесена:
            Классический массаж
            Вторник, 3 ноября, 12:00
            Ждём вас!""";

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

        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        bot = bot(context, TestOutboundMessages.create(jdbcClient, builder, json, clock));
    }

    @AfterEach
    void tearDown() {
        cleanUp(jdbc);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from working_hours where id = ?", hoursId);
    }

    @Test
    void confirmReschedulesAppointmentRecordsBotEventFreesOldStartAndRepeatShowsUpdatedMenu() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        UUID appointmentId = appointments
                .create(clientIdOf(jdbc, id), serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        sessions.save(
                id,
                new BotSession(Step.CONFIRM, null, TUESDAY, NEW_START, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));
        String confirmReplyId = "move_confirm:" + appointmentId + ":2026-11-03T07:00:00Z";

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("type").asString()).isEqualTo("text");
                    assertThat(textOf(body)).isEqualTo(MOVED_TEXT);
                })
                .andRespond(withSuccess(accepted("wamid.bot-rescheduled"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body))
                            .contains("Ваши записи:\nВторник, 3 ноября, 12:00 — Классический массаж");
                    assertThat(buttonIds(body)).containsExactly("book", "move", "cancel");
                })
                .andRespond(withSuccess(accepted("wamid.bot-rescheduled-repeat-menu"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, confirmReplyId));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertAppointment(appointmentId, NEW_START, NEW_END, AppointmentStatus.CONFIRMED);
        assertThat(botRescheduledEventsCount(appointmentId)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                        """
                        select payload->>'previous_start' from events
                        where type = 'appointment_rescheduled' and entity_id = ?""",
                        String.class,
                        appointmentId))
                .isEqualTo("2026-11-03T05:00:00Z");
        assertThat(slots.freeStarts(serviceId, TUESDAY).orElseThrow().starts())
                .contains(START)
                .doesNotContain(NEW_START);

        bot.on(reply(jdbc, id, confirmReplyId));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(botRescheduledEventsCount(appointmentId)).isEqualTo(1);
    }

    @Test
    void confirmKeepsBookedLengthWhenServiceDurationChangedBeforeConfirmation() {
        UUID id = conversation(clients, jdbc, "+998900001202");
        UUID appointmentId = appointments
                .create(clientIdOf(jdbc, id), serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        jdbc.update("update services set duration_min = 90 where id = ?", serviceId);
        sessions.save(
                id,
                new BotSession(Step.CONFIRM, null, TUESDAY, NEW_START, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(textOf(requestJson(json, request))).isEqualTo(MOVED_TEXT))
                .andRespond(withSuccess(accepted("wamid.bot-rescheduled-length"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "move_confirm:" + appointmentId + ":2026-11-03T07:00:00Z"));

        server.verify();
        assertAppointment(appointmentId, NEW_START, NEW_END, AppointmentStatus.CONFIRMED);
    }

    @Test
    void foreignPastCancelledOrAlreadyMovedToTargetTimeSendsGoneAndMenuWithoutBotReschedule() {
        UUID id = conversation(clients, jdbc, "+998900001204");
        UUID clientId = clientIdOf(jdbc, id);
        Client client = clients.findById(clientId).orElseThrow();
        Client other = clients.saveAndFlush(new Client("+998900001208", "Other client"));

        Instant foreignStart = Instant.parse("2026-11-03T08:00:00Z");
        UUID foreignId = appointments
                .create(other.getId(), serviceId, foreignStart, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        UUID pastId = appointmentRepository
                .saveAndFlush(new Appointment(
                        client,
                        service,
                        new TimeRange(PAST_START, PAST_START.plus(Duration.ofHours(1))),
                        AppointmentSource.MANUAL))
                .getId();
        UUID cancelledId = appointments
                .create(clientId, serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        appointments.cancel(cancelledId, EventActor.MASTER);

        for (int attempt = 1; attempt <= 3; attempt++) {
            expectGoneAndMenu(attempt, List.of("book"));
        }
        expectGoneAndMenu(4, List.of("book", "move", "cancel"));

        for (UUID badId : List.of(foreignId, pastId, cancelledId)) {
            sessions.save(
                    id,
                    new BotSession(Step.CONFIRM, null, TUESDAY, NEW_START, badId),
                    NOW.minus(Duration.ofMinutes(1)));
            bot.on(reply(jdbc, id, "move_confirm:" + badId + ":2026-11-03T07:00:00Z"));
            assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        }

        UUID alreadyMovedId = appointments
                .create(clientId, serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        appointments.reschedule(alreadyMovedId, NEW_START, EventActor.MASTER);
        sessions.save(
                id,
                new BotSession(Step.CONFIRM, null, TUESDAY, NEW_START, alreadyMovedId),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "move_confirm:" + alreadyMovedId + ":2026-11-03T07:00:00Z"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertAppointment(
                foreignId, foreignStart, foreignStart.plus(Duration.ofHours(1)), AppointmentStatus.CONFIRMED);
        assertAppointment(pastId, PAST_START, PAST_START.plus(Duration.ofHours(1)), AppointmentStatus.CONFIRMED);
        assertAppointment(cancelledId, START, START.plus(Duration.ofHours(1)), AppointmentStatus.CANCELLED);
        assertAppointment(alreadyMovedId, NEW_START, NEW_END, AppointmentStatus.CONFIRMED);
        assertThat(rescheduledEventsCount(foreignId)).isZero();
        assertThat(rescheduledEventsCount(pastId)).isZero();
        assertThat(rescheduledEventsCount(cancelledId)).isZero();
        assertThat(botRescheduledEventsCount(alreadyMovedId)).isZero();
    }

    @Test
    void timeTakenOrOutsideScheduleOnConfirmSendsTimeTakenTextAndRefreshedTimeList() {
        UUID id = conversation(clients, jdbc, "+998900001205");
        UUID appointmentId = appointments
                .create(clientIdOf(jdbc, id), serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        Client competitor = clients.saveAndFlush(new Client("+998900001209", "Competitor"));
        appointments.create(
                competitor.getId(), serviceId, NEW_START, AppointmentSource.MANUAL, EventActor.MASTER);

        for (int attempt = 1; attempt <= 2; attempt++) {
            int currentAttempt = attempt;
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(body.path("type").asString()).isEqualTo("text");
                        assertThat(textOf(body)).isEqualTo(BotReplies.TIME_TAKEN_TEXT);
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-reschedule-taken-text-" + currentAttempt),
                            APPLICATION_JSON));
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(interactiveBodyOf(body)).isEqualTo("Вторник, 3 ноября. Выберите время.");
                        assertThat(rowIds(body))
                                .doesNotContain(
                                        "time:2026-11-03T05:00:00Z",
                                        "time:2026-11-03T06:30:00Z",
                                        "time:2026-11-03T07:00:00Z",
                                        "time:2026-11-03T07:30:00Z")
                                .containsExactly(
                                        "time:2026-11-03T05:30:00Z",
                                        "time:2026-11-03T06:00:00Z",
                                        "time:2026-11-03T08:00:00Z",
                                        "time:2026-11-03T08:30:00Z",
                                        "time:2026-11-03T09:00:00Z",
                                        "time:2026-11-03T09:30:00Z",
                                        "time:2026-11-03T10:00:00Z",
                                        "other_day");
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-reschedule-taken-list-" + currentAttempt),
                            APPLICATION_JSON));
        }

        sessions.save(
                id,
                new BotSession(Step.CONFIRM, null, TUESDAY, NEW_START, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "move_confirm:" + appointmentId + ":2026-11-03T07:00:00Z"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, null, TUESDAY, null, appointmentId));
        assertAppointment(appointmentId, START, START.plus(Duration.ofHours(1)), AppointmentStatus.CONFIRMED);

        Instant outsideStart = Instant.parse("2026-11-03T12:00:00Z");
        sessions.save(
                id,
                new BotSession(Step.CONFIRM, null, TUESDAY, outsideStart, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "move_confirm:" + appointmentId + ":2026-11-03T12:00:00Z"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, null, TUESDAY, null, appointmentId));
        assertAppointment(appointmentId, START, START.plus(Duration.ofHours(1)), AppointmentStatus.CONFIRMED);
        assertThat(rescheduledEventsCount(appointmentId)).isZero();
    }

    private void expectGoneAndMenu(int attempt, List<String> expectedButtons) {
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("type").asString()).isEqualTo("text");
                    assertThat(textOf(body)).isEqualTo(BotReplies.GONE_TEXT);
                })
                .andRespond(withSuccess(
                        accepted("wamid.bot-reschedule-gone-text-" + attempt), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).startsWith(BotReplies.MENU_TEXT);
                    assertThat(buttonIds(body)).containsExactlyElementsOf(expectedButtons);
                })
                .andRespond(withSuccess(
                        accepted("wamid.bot-reschedule-gone-menu-" + attempt), APPLICATION_JSON));
    }

    private void assertAppointment(
            UUID appointmentId, Instant expectedStart, Instant expectedEnd, AppointmentStatus expectedStatus) {
        Appointment stored = appointmentRepository.findById(appointmentId).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(expectedStatus);
        assertThat(stored.getPeriod()).isEqualTo(new TimeRange(expectedStart, expectedEnd));
    }

    private int botRescheduledEventsCount(UUID appointmentId) {
        return jdbc.queryForObject(
                """
                select count(*) from events
                where type = 'appointment_rescheduled'
                  and actor = 'bot'
                  and entity_id = ?""",
                Integer.class,
                appointmentId);
    }

    private int rescheduledEventsCount(UUID appointmentId) {
        return jdbc.queryForObject(
                """
                select count(*) from events
                where type = 'appointment_rescheduled'
                  and entity_id = ?""",
                Integer.class,
                appointmentId);
    }

    private static String textOf(JsonNode body) {
        return body.path("text").path("body").asString("");
    }

    private static String interactiveBodyOf(JsonNode body) {
        return body.path("interactive").path("body").path("text").asString("");
    }
}
