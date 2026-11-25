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
class BookingBotMoveTimeTests {

    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 3);
    private static final Instant START = Instant.parse("2026-11-03T05:00:00Z");
    private static final Instant OVERLAPPING_START = Instant.parse("2026-11-03T05:30:00Z");
    private static final Instant NEW_START = Instant.parse("2026-11-03T07:00:00Z");
    private static final Instant COMPETITOR_START = Instant.parse("2026-11-03T08:00:00Z");
    private static final Instant PAST_START = Instant.parse("2026-11-02T03:00:00Z");
    private static final List<String> EXPECTED_DAYS = List.of(
            "day:2026-11-03",
            "day:2026-11-10",
            "day:2026-11-17",
            "day:2026-11-24",
            "day:2026-12-01");

    @Autowired private ApplicationContext context;
    @Autowired private BotSessionStore sessions;
    @Autowired private AppointmentService appointments;
    @Autowired private AppointmentRepository appointmentRepository;
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
    void moveDaySelectsTimeListWithoutOwnCurrentStartAndRepeatsDaysOnOutOfRangeDayOrFreeText() {
        assertThat(jdbc.queryForObject("select count(*) from working_hours", Integer.class))
                .isEqualTo(1);
        UUID id = conversation(clients, jdbc, "+998900001201");
        UUID appointmentId = appointments
                .create(clientIdOf(jdbc, id), serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        BotSession daySession = new BotSession(Step.DAY, null, null, null, appointmentId);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo("Вторник, 3 ноября. Выберите время.");
                    assertThat(firstRowTitleOf(body)).isEqualTo("10:30");
                    assertThat(rowIds(body))
                            .doesNotContain("time:2026-11-03T05:00:00Z")
                            .containsExactly(
                                    "time:2026-11-03T05:30:00Z",
                                    "time:2026-11-03T06:00:00Z",
                                    "time:2026-11-03T06:30:00Z",
                                    "time:2026-11-03T07:00:00Z",
                                    "time:2026-11-03T07:30:00Z",
                                    "time:2026-11-03T08:00:00Z",
                                    "time:2026-11-03T08:30:00Z",
                                    "time:2026-11-03T09:00:00Z",
                                    "more_times:2026-11-03T09:00:00Z",
                                    "other_day");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-day-times"), APPLICATION_JSON));
        for (int attempt = 1; attempt <= 2; attempt++) {
            int currentAttempt = attempt;
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(interactiveBodyOf(body)).isEqualTo("Выберите день.");
                        assertThat(rowIds(body)).containsExactlyElementsOf(EXPECTED_DAYS);
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-move-day-repeat-" + currentAttempt),
                            APPLICATION_JSON));
        }

        sessions.save(id, daySession, NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "day:2026-11-03"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, null, TUESDAY, null, appointmentId));

        sessions.save(id, daySession, NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "day:2026-12-02"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(daySession);

        bot.on(text(jdbc, id, "завтра"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(daySession);
    }

    @Test
    void moveTimeAcceptsFreeAndOverlappingOwnTimePaginatesAndReturnsToDays() {
        UUID id = conversation(clients, jdbc, "+998900001202");
        UUID appointmentId = appointments
                .create(clientIdOf(jdbc, id), serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        BotSession timeSession = new BotSession(Step.TIME, null, TUESDAY, null, appointmentId);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body))
                            .isEqualTo("""
                                    Перенести запись?
                                    Классический массаж
                                    Сейчас: Вторник, 3 ноября, 10:00
                                    Новое время: Вторник, 3 ноября, 12:00""");
                    assertThat(buttonIds(body))
                            .containsExactly(
                                    "move_confirm:" + appointmentId + ":2026-11-03T07:00:00Z",
                                    "other_time");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-time-confirm-12"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body))
                            .isEqualTo("""
                                    Перенести запись?
                                    Классический массаж
                                    Сейчас: Вторник, 3 ноября, 10:00
                                    Новое время: Вторник, 3 ноября, 10:30""");
                    assertThat(buttonIds(body))
                            .containsExactly(
                                    "move_confirm:" + appointmentId + ":2026-11-03T05:30:00Z",
                                    "other_time");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-time-confirm-1030"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo("Вторник, 3 ноября. Выберите время.");
                    assertThat(rowIds(body))
                            .containsExactly(
                                    "time:2026-11-03T09:30:00Z",
                                    "time:2026-11-03T10:00:00Z",
                                    "other_day");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-time-more"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo("Выберите день.");
                    assertThat(rowIds(body)).containsExactlyElementsOf(EXPECTED_DAYS);
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-time-other-day"), APPLICATION_JSON));

        sessions.save(id, timeSession, NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "time:2026-11-03T07:00:00Z"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.CONFIRM, null, TUESDAY, NEW_START, appointmentId));

        sessions.save(id, timeSession, NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "time:2026-11-03T05:30:00Z"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.CONFIRM, null, TUESDAY, OVERLAPPING_START, appointmentId));

        sessions.save(id, timeSession, NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "more_times:2026-11-03T09:00:00Z"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(timeSession);

        bot.on(reply(jdbc, id, "other_day"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.DAY, null, null, null, appointmentId));
    }

    @Test
    void moveTimeRejectsOwnCurrentStartAndCompetitorTimeWithTimeTakenAndIgnoresOtherDayTime() {
        UUID id = conversation(clients, jdbc, "+998900001203");
        UUID appointmentId = appointments
                .create(clientIdOf(jdbc, id), serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        Client competitor = clients.saveAndFlush(new Client("+998900001209", "Competitor"));
        appointments.create(
                competitor.getId(), serviceId, COMPETITOR_START, AppointmentSource.MANUAL, EventActor.MASTER);
        BotSession timeSession = new BotSession(Step.TIME, null, TUESDAY, null, appointmentId);

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
                            accepted("wamid.bot-move-taken-text-" + currentAttempt),
                            APPLICATION_JSON));
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(interactiveBodyOf(body)).isEqualTo("Вторник, 3 ноября. Выберите время.");
                        assertThat(rowIds(body))
                                .doesNotContain(
                                        "time:2026-11-03T05:00:00Z",
                                        "time:2026-11-03T07:30:00Z",
                                        "time:2026-11-03T08:00:00Z",
                                        "time:2026-11-03T08:30:00Z")
                                .containsExactly(
                                        "time:2026-11-03T05:30:00Z",
                                        "time:2026-11-03T06:00:00Z",
                                        "time:2026-11-03T06:30:00Z",
                                        "time:2026-11-03T07:00:00Z",
                                        "time:2026-11-03T09:00:00Z",
                                        "time:2026-11-03T09:30:00Z",
                                        "time:2026-11-03T10:00:00Z",
                                        "other_day");
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-move-taken-list-" + currentAttempt),
                            APPLICATION_JSON));
        }
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo("Вторник, 3 ноября. Выберите время.");
                    assertThat(rowIds(body)).first().isEqualTo("time:2026-11-03T05:30:00Z");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-other-day-time"), APPLICATION_JSON));

        sessions.save(id, timeSession, NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "time:2026-11-03T05:00:00Z"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(timeSession);

        bot.on(reply(jdbc, id, "time:2026-11-03T08:00:00Z"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(timeSession);

        bot.on(reply(jdbc, id, "time:2026-11-10T05:00:00Z"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(timeSession);
    }

    @Test
    void foreignPastOrCancelledAppointmentInDayOrTimeSessionSendsGoneAndMenuWithoutChanges() {
        UUID id = conversation(clients, jdbc, "+998900001204");
        UUID clientId = clientIdOf(jdbc, id);
        Client client = clients.findById(clientId).orElseThrow();
        Client other = clients.saveAndFlush(new Client("+998900001208", "Other client"));

        Instant foreignStart = Instant.parse("2026-11-03T08:00:00Z");
        UUID foreignId = appointments
                .create(other.getId(), serviceId, foreignStart, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        UUID pastId = saveDirect(client, PAST_START).getId();
        UUID cancelledId = appointments
                .create(clientId, serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        appointments.cancel(cancelledId, EventActor.MASTER);

        for (int attempt = 1; attempt <= 6; attempt++) {
            int currentAttempt = attempt;
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(body.path("type").asString()).isEqualTo("text");
                        assertThat(textOf(body)).isEqualTo(BotReplies.GONE_TEXT);
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-move-gone-text-" + currentAttempt),
                            APPLICATION_JSON));
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(interactiveBodyOf(body)).isEqualTo(BotReplies.MENU_TEXT);
                        assertThat(buttonIds(body)).containsExactly("book");
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-move-gone-menu-" + currentAttempt),
                            APPLICATION_JSON));
        }

        for (UUID badId : List.of(foreignId, pastId, cancelledId)) {
            sessions.save(
                    id,
                    new BotSession(Step.DAY, null, null, null, badId),
                    NOW.minus(Duration.ofMinutes(1)));
            bot.on(reply(jdbc, id, "day:2026-11-03"));
            assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());

            sessions.save(
                    id,
                    new BotSession(Step.TIME, null, TUESDAY, null, badId),
                    NOW.minus(Duration.ofMinutes(1)));
            bot.on(reply(jdbc, id, "time:2026-11-03T07:00:00Z"));
            assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        }

        server.verify();
        assertUnchanged(foreignId, foreignStart, AppointmentStatus.CONFIRMED);
        assertUnchanged(pastId, PAST_START, AppointmentStatus.CONFIRMED);
        assertUnchanged(cancelledId, START, AppointmentStatus.CANCELLED);
    }

    @Test
    void bookButtonOnMoveDayAndMoveTimeOpensServiceList() {
        UUID id = conversation(clients, jdbc, "+998900001205");
        UUID appointmentId = appointments
                .create(clientIdOf(jdbc, id), serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        for (int attempt = 1; attempt <= 2; attempt++) {
            int currentAttempt = attempt;
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(interactiveBodyOf(body)).isEqualTo("Выберите массаж из списка.");
                        assertThat(rowIds(body)).contains("service:" + serviceId);
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-move-book-" + currentAttempt), APPLICATION_JSON));
        }

        sessions.save(
                id,
                new BotSession(Step.DAY, null, null, null, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "book"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.SERVICE, null, null, null, null));

        sessions.save(
                id,
                new BotSession(Step.TIME, null, TUESDAY, null, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "book"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.SERVICE, null, null, null, null));
        assertUnchanged(appointmentId, START, AppointmentStatus.CONFIRMED);
    }

    private Appointment saveDirect(Client forClient, Instant start) {
        return appointmentRepository.saveAndFlush(new Appointment(
                forClient,
                service,
                new TimeRange(start, start.plus(Duration.ofHours(1))),
                AppointmentSource.MANUAL));
    }

    private void assertUnchanged(UUID appointmentId, Instant expectedStart, AppointmentStatus expectedStatus) {
        Appointment stored = appointmentRepository.findById(appointmentId).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(expectedStatus);
        assertThat(stored.getPeriod().start()).isEqualTo(expectedStart);
    }

    private static String textOf(JsonNode body) {
        return body.path("text").path("body").asString("");
    }

    private static String interactiveBodyOf(JsonNode body) {
        return body.path("interactive").path("body").path("text").asString("");
    }

    private static String firstRowTitleOf(JsonNode body) {
        return body.path("interactive")
                .path("action")
                .path("sections")
                .path(0)
                .path("rows")
                .path(0)
                .path("title")
                .asString("");
    }
}
