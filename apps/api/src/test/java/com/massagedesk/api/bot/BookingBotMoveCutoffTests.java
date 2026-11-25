package com.massagedesk.api.bot;

import static com.massagedesk.api.bot.BotConversations.bot;
import static com.massagedesk.api.bot.BotConversations.botAt;
import static com.massagedesk.api.bot.BotConversations.buttonIds;
import static com.massagedesk.api.bot.BotConversations.cleanUp;
import static com.massagedesk.api.bot.BotConversations.conversation;
import static com.massagedesk.api.bot.BotConversations.interactiveBodyOf;
import static com.massagedesk.api.bot.BotConversations.reply;
import static com.massagedesk.api.bot.BotConversations.requestJson;
import static com.massagedesk.api.bot.BotConversations.rowIds;
import static com.massagedesk.api.bot.BotConversations.saveDirect;
import static com.massagedesk.api.bot.BotConversations.textOf;
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
import com.massagedesk.api.booking.AppointmentStatus;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.OutboundMessages;
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
class BookingBotMoveCutoffTests {

    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 3);
    private static final Instant START = Instant.parse("2026-11-02T05:45:00Z");
    private static final Instant NEW_START = Instant.parse("2026-11-03T07:00:00Z");
    private static final Instant NEW_END = Instant.parse("2026-11-03T08:00:00Z");
    private static final String CONFIRMATION_TEXT = """
            Перенести запись?
            Классический массаж
            Сейчас: Понедельник, 2 ноября, 10:45
            Новое время: Вторник, 3 ноября, 12:00""";
    private static final String MOVED_TEXT = """
            Запись перенесена:
            Классический массаж
            Вторник, 3 ноября, 12:00
            Ждём вас!""";
    private static final String MENU_WITH_APPOINTMENT_TEXT = """
            Здравствуйте! Я помогу записаться на массаж.

            Ваши записи:
            Понедельник, 2 ноября, 10:45 — Классический массаж""";
    private static final String MENU_WITHOUT_APPOINTMENT_TEXT =
            "Здравствуйте! Я помогу записаться на массаж.";
    private static final String TOO_LATE_30_TEXT =
            "До начала записи меньше 30 минут, поэтому перенести её через бота уже нельзя. "
                    + "Если не успеваете, напишите здесь — мастер увидит ваше сообщение и ответит.";
    private static final String GONE_TEXT = "Эту запись уже изменили или отменили.";

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
    private OutboundMessages outbound;
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
        outbound = TestOutboundMessages.create(jdbcClient, builder, json, clock);
        bot = bot(context, outbound);
    }

    @AfterEach
    void tearDown() {
        cleanUp(jdbc);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from working_hours where id = ?", hoursId);
    }

    @Test
    void pickAtExactBoundaryOpensDayList() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        UUID appointmentId = saveDirect(clients, appointmentRepository, jdbc, service, id, START).getId();
        sessions.save(
                id,
                new BotSession(Step.MOVE_PICK, null, null, null, null),
                NOW.minus(Duration.ofMinutes(1)));

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("interactive").path("type").asString()).isEqualTo("list");
                    assertThat(interactiveBodyOf(body)).isEqualTo("Выберите день.");
                    assertThat(rowIds(body)).first().isEqualTo("day:2026-11-03");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-cutoff-pick-boundary"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "appointment:" + appointmentId));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.DAY, null, null, null, appointmentId));
        assertAppointment(appointmentId, START, START.plus(Duration.ofHours(1)), AppointmentStatus.CONFIRMED);
    }

    @Test
    void pickOneSecondInsideCutoffSendsTooLateNoticeAndMenuAndKeepsAppointmentAtOriginalTime() {
        UUID id = conversation(clients, jdbc, "+998900001202");
        UUID appointmentId = saveDirect(clients, appointmentRepository, jdbc, service, id, START).getId();
        sessions.save(
                id,
                new BotSession(Step.MOVE_PICK, null, null, null, null),
                NOW.minus(Duration.ofMinutes(1)));

        expectTextAndMenuWithAppointment(TOO_LATE_30_TEXT, "pick-too-late");

        botAt(context, outbound, NOW.plusSeconds(1)).on(reply(jdbc, id, "appointment:" + appointmentId));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertAppointment(appointmentId, START, START.plus(Duration.ofHours(1)), AppointmentStatus.CONFIRMED);
        assertThat(rescheduledEventsCount(appointmentId)).isZero();
    }

    @Test
    void confirmAfterCutoffPassedSinceConfirmationWasShownRefusesToMoveAndReturnsToMenu() {
        UUID id = conversation(clients, jdbc, "+998900001203");
        UUID appointmentId = saveDirect(clients, appointmentRepository, jdbc, service, id, START).getId();
        sessions.save(id, BotSession.menu(), NOW.minus(Duration.ofMinutes(1)));
        String confirmReplyId = "move_confirm:" + appointmentId + ":2026-11-03T07:00:00Z";

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo("Какую запись перенести?");
                    assertThat(rowIds(body)).containsExactly("appointment:" + appointmentId);
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-cutoff-picks"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("interactive").path("type").asString()).isEqualTo("list");
                    assertThat(interactiveBodyOf(body)).isEqualTo("Выберите день.");
                    assertThat(rowIds(body)).first().isEqualTo("day:2026-11-03");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-cutoff-days"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("interactive").path("type").asString()).isEqualTo("list");
                    assertThat(interactiveBodyOf(body)).isEqualTo("Вторник, 3 ноября. Выберите время.");
                    assertThat(rowIds(body)).contains("time:2026-11-03T07:00:00Z");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-cutoff-times"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo(CONFIRMATION_TEXT);
                    assertThat(buttonIds(body)).containsExactly(confirmReplyId, "other_time");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-cutoff-confirm-shown"), APPLICATION_JSON));
        expectTextAndMenuWithAppointment(TOO_LATE_30_TEXT, "confirm-too-late");

        bot.on(reply(jdbc, id, "move"));
        bot.on(reply(jdbc, id, "appointment:" + appointmentId));
        bot.on(reply(jdbc, id, "day:2026-11-03"));
        bot.on(reply(jdbc, id, "time:2026-11-03T07:00:00Z"));
        botAt(context, outbound, NOW.plusSeconds(1)).on(reply(jdbc, id, confirmReplyId));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertAppointment(appointmentId, START, START.plus(Duration.ofHours(1)), AppointmentStatus.CONFIRMED);
        assertThat(rescheduledEventsCount(appointmentId)).isZero();
    }

    @Test
    void confirmAtExactBoundaryReschedulesAppointmentAndRecordsBotEvent() {
        UUID id = conversation(clients, jdbc, "+998900001204");
        UUID appointmentId = saveDirect(clients, appointmentRepository, jdbc, service, id, START).getId();
        sessions.save(
                id,
                new BotSession(Step.CONFIRM, null, TUESDAY, NEW_START, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("type").asString()).isEqualTo("text");
                    assertThat(textOf(body)).isEqualTo(MOVED_TEXT);
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-cutoff-moved"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "move_confirm:" + appointmentId + ":2026-11-03T07:00:00Z"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertAppointment(appointmentId, NEW_START, NEW_END, AppointmentStatus.CONFIRMED);
        assertThat(botRescheduledEventsCount(appointmentId)).isEqualTo(1);
    }

    @Test
    void confirmInsideCutoffWhenAlreadyCancelledByMasterSendsGoneInsteadOfTooLate() {
        UUID id = conversation(clients, jdbc, "+998900001205");
        UUID appointmentId = saveDirect(clients, appointmentRepository, jdbc, service, id, START).getId();
        sessions.save(
                id,
                new BotSession(Step.CONFIRM, null, TUESDAY, NEW_START, appointmentId),
                NOW.minus(Duration.ofMinutes(1)));
        appointments.cancel(appointmentId, EventActor.MASTER);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("type").asString()).isEqualTo("text");
                    assertThat(textOf(body)).isEqualTo(GONE_TEXT);
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-cutoff-gone-text"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo(MENU_WITHOUT_APPOINTMENT_TEXT);
                    assertThat(buttonIds(body)).containsExactly("book");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-cutoff-gone-menu"), APPLICATION_JSON));

        botAt(context, outbound, NOW.plusSeconds(1))
                .on(reply(jdbc, id, "move_confirm:" + appointmentId + ":2026-11-03T07:00:00Z"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(rescheduledEventsCount(appointmentId)).isZero();
    }

    @Test
    void masterCanRescheduleAppointmentStartingInFiveMinutes() {
        UUID id = conversation(clients, jdbc, "+998900001206");
        UUID appointmentId = saveDirect(clients, appointmentRepository, jdbc, service, id, Instant.parse("2026-11-02T05:20:00Z")).getId();

        appointments.reschedule(appointmentId, NEW_START, EventActor.MASTER);

        assertAppointment(appointmentId, NEW_START, NEW_END, AppointmentStatus.CONFIRMED);
    }

    private void expectTextAndMenuWithAppointment(String expectedText, String wamidSuffix) {
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("type").asString()).isEqualTo("text");
                    assertThat(textOf(body)).isEqualTo(expectedText);
                })
                .andRespond(withSuccess(
                        accepted("wamid.bot-move-cutoff-text-" + wamidSuffix), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo(MENU_WITH_APPOINTMENT_TEXT);
                    assertThat(buttonIds(body)).containsExactly("book", "move", "cancel");
                })
                .andRespond(withSuccess(
                        accepted("wamid.bot-move-cutoff-menu-" + wamidSuffix), APPLICATION_JSON));
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
}
