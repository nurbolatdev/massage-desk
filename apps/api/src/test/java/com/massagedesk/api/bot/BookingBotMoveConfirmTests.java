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
class BookingBotMoveConfirmTests {

    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 3);
    private static final Instant START = Instant.parse("2026-11-03T05:00:00Z");
    private static final Instant NEW_START = Instant.parse("2026-11-03T07:00:00Z");
    private static final String CONFIRMATION_TEXT = """
            Перенести запись?
            Классический массаж
            Сейчас: Вторник, 3 ноября, 10:00
            Новое время: Вторник, 3 ноября, 12:00""";

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
    void mismatchedButtonsOrFreeTextRepeatConfirmationAndOtherTimeOrBookLeaveConfirm() {
        UUID id = conversation(clients, jdbc, "+998900001203");
        UUID clientId = clientIdOf(jdbc, id);
        UUID appointmentId = appointments
                .create(clientId, serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        UUID otherOwnId = appointments
                .create(
                        clientId,
                        serviceId,
                        Instant.parse("2026-11-10T05:00:00Z"),
                        AppointmentSource.MANUAL,
                        EventActor.MASTER)
                .id();
        BotSession confirmSession = new BotSession(Step.CONFIRM, null, TUESDAY, NEW_START, appointmentId);
        sessions.save(id, confirmSession, NOW.minus(Duration.ofMinutes(1)));

        for (int attempt = 1; attempt <= 4; attempt++) {
            int currentAttempt = attempt;
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(interactiveBodyOf(body)).isEqualTo(CONFIRMATION_TEXT);
                        assertThat(buttonIds(body))
                                .containsExactly(
                                        "move_confirm:" + appointmentId + ":2026-11-03T07:00:00Z",
                                        "other_time");
                    })
                    .andRespond(withSuccess(
                            accepted("wamid.bot-move-confirm-repeat-" + currentAttempt),
                            APPLICATION_JSON));
        }
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo("Вторник, 3 ноября. Выберите время.");
                    assertThat(rowIds(body))
                            .doesNotContain("time:2026-11-03T05:00:00Z")
                            .first()
                            .isEqualTo("time:2026-11-03T05:30:00Z");
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-confirm-other-time"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(interactiveBodyOf(body)).isEqualTo("Выберите массаж из списка.");
                    assertThat(rowIds(body)).contains("service:" + serviceId);
                })
                .andRespond(withSuccess(accepted("wamid.bot-move-confirm-book"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "move_confirm:" + otherOwnId + ":2026-11-03T07:00:00Z"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(confirmSession);

        bot.on(reply(jdbc, id, "move_confirm:" + appointmentId + ":2026-11-03T08:00:00Z"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(confirmSession);

        bot.on(reply(jdbc, id, "confirm:" + serviceId + ":2026-11-03T07:00:00Z"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(confirmSession);

        bot.on(text(jdbc, id, "да"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(confirmSession);

        bot.on(reply(jdbc, id, "other_time"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, null, TUESDAY, null, appointmentId));

        sessions.save(id, confirmSession, NOW.minus(Duration.ofMinutes(1)));
        bot.on(reply(jdbc, id, "book"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.SERVICE, null, null, null, null));
        assertAppointment(appointmentId, START, START.plus(Duration.ofHours(1)), AppointmentStatus.CONFIRMED);
        assertThat(rescheduledEventsCount(appointmentId)).isZero();
        assertThat(rescheduledEventsCount(otherOwnId)).isZero();
    }

    private void assertAppointment(
            UUID appointmentId, Instant expectedStart, Instant expectedEnd, AppointmentStatus expectedStatus) {
        Appointment stored = appointmentRepository.findById(appointmentId).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(expectedStatus);
        assertThat(stored.getPeriod()).isEqualTo(new TimeRange(expectedStart, expectedEnd));
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

    private static String interactiveBodyOf(JsonNode body) {
        return body.path("interactive").path("body").path("text").asString("");
    }
}
