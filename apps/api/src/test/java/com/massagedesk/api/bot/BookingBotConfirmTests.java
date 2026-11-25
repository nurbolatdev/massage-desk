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
import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.clients.Client;
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
class BookingBotConfirmTests {

    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 3);
    private static final Instant START = Instant.parse("2026-11-03T05:00:00Z");
    private static final Instant END = Instant.parse("2026-11-03T06:00:00Z");
    private static final String BOOKED_TEXT =
            "Вы записаны:\nКлассический массаж\nВторник, 3 ноября, 10:00\n60\u00a0мин · 8\u00a0000\u00a0₸\nЖдём вас!";

    private record StoredAppointment(Instant startAt, Instant endAt, String source, String status) {
    }

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
    void confirmCreatesAppointmentRecordsEventAndIdempotencyKeyAndReplaysOnStaleConfirmRead() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        Instant sessionAt = NOW.minus(Duration.ofMinutes(1));
        BotSession confirmSession = new BotSession(Step.CONFIRM, serviceId, TUESDAY, START, null);
        sessions.save(id, confirmSession, sessionAt);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("type").asString()).isEqualTo("text");
                    assertThat(body.path("text").path("body").asString()).isEqualTo(BOOKED_TEXT);
                })
                .andRespond(withSuccess(accepted("wamid.bot-booked-1"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(buttonIds(requestJson(json, request))).containsExactly("book"))
                .andRespond(withSuccess(accepted("wamid.bot-booked-menu"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("type").asString()).isEqualTo("text");
                    assertThat(body.path("text").path("body").asString()).isEqualTo(BOOKED_TEXT);
                })
                .andRespond(withSuccess(accepted("wamid.bot-booked-replay"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "confirm:" + START));

        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentsOf(clientIdOf(jdbc, id)))
                .containsExactly(new StoredAppointment(START, END, "bot", "confirmed"));
        assertThat(createdEventsCount(clientIdOf(jdbc, id))).isEqualTo(1);
        assertThat(jdbc.queryForList(
                        """
                        select user_id from idempotency_keys
                        where appointment_id in (select id from appointments where client_id = ?)""",
                        UUID.class,
                        clientIdOf(jdbc, id)))
                .containsExactly(BookingBot.BOT_REQUEST_USER);

        // Repeat confirm after session moved to menu -> menu reply, still one appointment.
        bot.on(reply(jdbc, id, "confirm:" + START));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentsOf(clientIdOf(jdbc, id))).hasSize(1);

        // Stale read: another worker read the same CONFIRM session with the same updated_at.
        sessions.save(id, confirmSession, sessionAt);
        bot.on(reply(jdbc, id, "confirm:" + START));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentsOf(clientIdOf(jdbc, id))).hasSize(1);
        assertThat(createdEventsCount(clientIdOf(jdbc, id))).isEqualTo(1);
    }

    @Test
    void timeTakenOrOutsideScheduleSendsTimeTakenTextAndRefreshedTimeListWithoutBooking() {
        UUID id = conversation(clients, jdbc, "+998900001202");
        Client competitor = clients.saveAndFlush(new Client("+998900001209", "Other client"));
        appointments.create(competitor.getId(), serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER);

        for (int attempt = 1; attempt <= 2; attempt++) {
            int currentAttempt = attempt;
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(body.path("type").asString()).isEqualTo("text");
                        assertThat(body.path("text").path("body").asString()).isEqualTo(BotReplies.TIME_TAKEN_TEXT);
                    })
                    .andRespond(withSuccess(accepted("wamid.bot-confirm-taken-text-" + currentAttempt), APPLICATION_JSON));
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        List<String> ids = rowIds(requestJson(json, request));
                        assertThat(ids).doesNotContain("time:2026-11-03T05:00:00Z", "time:2026-11-03T05:30:00Z");
                        assertThat(ids.get(0)).isEqualTo("time:2026-11-03T06:00:00Z");
                    })
                    .andRespond(withSuccess(accepted("wamid.bot-confirm-taken-list-" + currentAttempt), APPLICATION_JSON));
        }

        sessions.save(
                id,
                new BotSession(Step.CONFIRM, serviceId, TUESDAY, START, null),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "confirm:" + START));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, serviceId, TUESDAY, null, null));
        assertThat(appointmentsOf(clientIdOf(jdbc, id))).isEmpty();

        // OUTSIDE_SCHEDULE: 12:00Z = 17:00 Asia/Tashkent, outside Tuesday 10:00-16:00.
        sessions.save(
                id,
                new BotSession(Step.CONFIRM, serviceId, TUESDAY, Instant.parse("2026-11-03T12:00:00Z"), null),
                NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "confirm:2026-11-03T12:00:00Z"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, serviceId, TUESDAY, null, null));
        assertThat(appointmentsOf(clientIdOf(jdbc, id))).isEmpty();
    }

    @Test
    void deactivatedServiceBeforeConfirmFallsBackToServiceListOrNoServicesWithoutBooking() {
        UUID id = conversation(clients, jdbc, "+998900001203");
        jdbc.update("update services set active = false where id = ?", serviceId);
        UUID otherServiceId = serviceRepository
                .saveAndFlush(new MassageService("Лимфодренажный массаж", 60, new BigDecimal("9000.00"), 2))
                .getId();
        try {
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                            .containsExactly(BotReplies.SERVICE_PREFIX + otherServiceId))
                    .andRespond(withSuccess(accepted("wamid.bot-confirm-svc-list"), APPLICATION_JSON));
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(body.path("type").asString()).isEqualTo("text");
                        assertThat(body.path("text").path("body").asString()).isEqualTo(BotReplies.NO_SERVICES_TEXT);
                    })
                    .andRespond(withSuccess(accepted("wamid.bot-confirm-no-svc"), APPLICATION_JSON));

            sessions.save(
                    id,
                    new BotSession(Step.CONFIRM, serviceId, TUESDAY, START, null),
                    NOW.minus(Duration.ofMinutes(1)));
            bot.on(reply(jdbc, id, "confirm:" + START));
            assertThat(sessions.load(id).orElseThrow().session())
                    .isEqualTo(new BotSession(Step.SERVICE, null, null, null, null));
            assertThat(appointmentsOf(clientIdOf(jdbc, id))).isEmpty();

            jdbc.update("update services set active = false where id = ?", otherServiceId);
            assertThat(jdbc.queryForObject("select count(*) from services where active", Integer.class))
                    .isZero();
            sessions.save(
                    id,
                    new BotSession(Step.CONFIRM, serviceId, TUESDAY, START, null),
                    NOW.minus(Duration.ofMinutes(1)));
            bot.on(reply(jdbc, id, "confirm:" + START));

            server.verify();
            assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
            assertThat(appointmentsOf(clientIdOf(jdbc, id))).isEmpty();
        } finally {
            jdbc.update("delete from services where id = ?", otherServiceId);
        }
    }

    @Test
    void otherTimeReturnsToTimeListAndFreeTextRepeatsConfirmation() {
        UUID id = conversation(clients, jdbc, "+998900001204");
        BotSession confirmSession = new BotSession(Step.CONFIRM, serviceId, TUESDAY, START, null);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .first()
                        .isEqualTo("time:2026-11-03T05:00:00Z"))
                .andRespond(withSuccess(accepted("wamid.bot-confirm-other-time"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("interactive").path("body").path("text").asString())
                            .isEqualTo(
                                    "Проверьте запись:\nКлассический массаж\nВторник, 3 ноября, 10:00\n60\u00a0мин · 8\u00a0000\u00a0₸");
                    assertThat(buttonIds(body)).containsExactly("confirm:2026-11-03T05:00:00Z", "other_time");
                })
                .andRespond(withSuccess(accepted("wamid.bot-confirm-repeat"), APPLICATION_JSON));

        sessions.save(id, confirmSession, NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "other_time"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, serviceId, TUESDAY, null, null));

        sessions.save(id, confirmSession, NOW.minus(Duration.ofMinutes(1)));
        bot.on(text(jdbc, id, "да"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(confirmSession);
        assertThat(appointmentsOf(clientIdOf(jdbc, id))).isEmpty();
    }

    @Test
    void staleOrBareConfirmButtonRepeatsCurrentConfirmationWithoutBooking() {
        UUID id = conversation(clients, jdbc, "+998900001205");
        BotSession confirmSession = new BotSession(Step.CONFIRM, serviceId, TUESDAY, START, null);
        sessions.save(id, confirmSession, NOW.minus(Duration.ofMinutes(1)));
        for (int attempt = 1; attempt <= 2; attempt++) {
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> assertThat(buttonIds(requestJson(json, request)))
                            .containsExactly("confirm:2026-11-03T05:00:00Z", "other_time"))
                    .andRespond(withSuccess(accepted("wamid.bot-confirm-stale-" + attempt), APPLICATION_JSON));
        }

        bot.on(reply(jdbc, id, "confirm:2026-11-03T06:00:00Z"));
        bot.on(reply(jdbc, id, "confirm"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(confirmSession);
        assertThat(appointmentsOf(clientIdOf(jdbc, id))).isEmpty();
    }

    private List<StoredAppointment> appointmentsOf(UUID clientId) {
        return jdbc.query(
                """
                select lower(period) as start_at, upper(period) as end_at, source, status
                from appointments where client_id = ?""",
                (rs, rowNum) -> new StoredAppointment(
                        rs.getObject("start_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("end_at", OffsetDateTime.class).toInstant(),
                        rs.getString("source"),
                        rs.getString("status")),
                clientId);
    }

    private int createdEventsCount(UUID clientId) {
        return jdbc.queryForObject(
                """
                select count(*) from events
                where type = 'appointment_created'
                  and actor = 'bot'
                  and entity_id in (select id from appointments where client_id = ?)""",
                Integer.class,
                clientId);
    }
}
