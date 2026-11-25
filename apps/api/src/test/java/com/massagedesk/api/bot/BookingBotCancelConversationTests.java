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
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.AppointmentRepository;
import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.booking.AppointmentStatus;
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
import java.time.Instant;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
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
class BookingBotCancelConversationTests {

    private static final Instant START_10_00 = Instant.parse("2026-11-03T05:00:00Z");
    private static final Instant START_14_00 = Instant.parse("2026-11-03T09:00:00Z");
    private static final Instant END_15_00 = Instant.parse("2026-11-03T10:00:00Z");

    private record StoredAppointment(Instant startAt, Instant endAt, String source, String status) {}

    private record StoredEvent(String type, String actor) {}

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
    void fullConversationFromBookingToCancellationAndEmptyMenu() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        UUID clientId = clientIdOf(jdbc, id);
        AtomicReference<String> nextReplyId = new AtomicReference<>();

        expectReply(1, body -> nextReplyId.set(buttonIds(body).get(0)));
        expectReply(2, body -> nextReplyId.set(rowIds(body).get(0)));
        expectReply(3, body -> nextReplyId.set(rowIds(body).get(0)));
        expectReply(4, body -> nextReplyId.set(rowIds(body).get(8)));
        expectReply(5, body -> nextReplyId.set(rowIds(body).get(0)));
        expectReply(6, body -> nextReplyId.set(buttonIds(body).get(0)));
        expectReply(7, body -> assertThat(body.path("text").path("body").asString())
                .contains("Вы записаны:\nКлассический массаж\nВторник, 3 ноября, 14:00"));
        expectReply(8, body -> {
            assertThat(interactiveBodyOf(body))
                    .contains("Ваши записи:\nВторник, 3 ноября, 14:00 — Классический массаж");
            assertThat(buttonIds(body)).containsExactly("book", "move", "cancel");
            nextReplyId.set(buttonIds(body).get(2));
        });
        expectReply(9, body -> {
            assertThat(rowIds(body)).hasSize(1);
            nextReplyId.set(rowIds(body).get(0));
        });
        expectReply(10, body -> {
            assertThat(interactiveBodyOf(body))
                    .isEqualTo("Отменить запись?\nКлассический массаж\nВторник, 3 ноября, 14:00");
            nextReplyId.set(buttonIds(body).get(0));
        });
        expectReply(11, body -> {
            assertThat(interactiveBodyOf(body))
                    .isEqualTo("Запись отменена:\nКлассический массаж\nВторник, 3 ноября, 14:00");
            assertThat(buttonIds(body)).containsExactly("book");
        });
        expectReply(12, body -> {
            assertThat(interactiveBodyOf(body)).isEqualTo(BotReplies.MENU_TEXT);
            assertThat(buttonIds(body)).containsExactly("book");
        });

        bot.on(text(jdbc, id, "Здравствуйте"));
        for (int turn = 0; turn < 6; turn++) {
            bot.on(reply(jdbc, id, nextReplyId.getAndSet(null)));
        }
        bot.on(text(jdbc, id, "Здравствуйте"));
        for (int turn = 0; turn < 3; turn++) {
            bot.on(reply(jdbc, id, nextReplyId.getAndSet(null)));
        }
        bot.on(text(jdbc, id, "Здравствуйте"));

        server.verify();
        assertThat(appointmentsOf(clientId))
                .containsExactly(new StoredAppointment(START_14_00, END_15_00, "bot", "cancelled"));
        assertThat(eventsOfClient(clientId))
                .containsExactly(
                        new StoredEvent("appointment_created", "bot"),
                        new StoredEvent("appointment_cancelled", "bot"));
        List<StoredMessage> messages = messagesOf(jdbc, id);
        assertThat(messages).hasSize(12).allSatisfy(m -> {
            assertThat(m.direction()).isEqualTo("out");
            assertThat(m.author()).isEqualTo("bot");
            assertThat(m.body()).isNotBlank();
        });
    }

    @Test
    void secondClientCannotSeeOrCancelFirstClientsAppointment() {
        UUID conversationA = conversation(clients, jdbc, "+998900001202");
        UUID conversationB = conversation(clients, jdbc, "+998900001203");
        UUID appointmentA = appointments
                .create(clientIdOf(jdbc, conversationA), serviceId, START_10_00, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        UUID appointmentB = appointments
                .create(clientIdOf(jdbc, conversationB), serviceId, START_14_00, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        AtomicReference<String> nextReplyId = new AtomicReference<>();

        expectReply(1, body -> {
            assertThat(interactiveBodyOf(body))
                    .contains("Вторник, 3 ноября, 14:00 — Классический массаж")
                    .doesNotContain("10:00");
            assertThat(buttonIds(body)).containsExactly("book", "move", "cancel");
            nextReplyId.set(buttonIds(body).get(2));
        });
        for (int step = 2; step <= 3; step++) {
            expectReply(step, body -> {
                assertThat(rowIds(body)).containsExactly("appointment:" + appointmentB);
                nextReplyId.set(rowIds(body).get(0));
            });
        }
        for (int step = 4; step <= 5; step++) {
            expectReply(step, body -> {
                assertThat(interactiveBodyOf(body))
                        .isEqualTo("Отменить запись?\nКлассический массаж\nВторник, 3 ноября, 14:00");
                assertThat(buttonIds(body))
                        .containsExactly("cancel_confirm:" + appointmentB, "keep");
            });
        }

        bot.on(text(jdbc, conversationB, "Здравствуйте"));
        bot.on(reply(jdbc, conversationB, nextReplyId.getAndSet(null)));
        bot.on(reply(jdbc, conversationB, "appointment:" + appointmentA));
        bot.on(reply(jdbc, conversationB, nextReplyId.getAndSet(null)));
        bot.on(reply(jdbc, conversationB, "cancel_confirm:" + appointmentA));

        server.verify();
        assertThat(sessions.load(conversationB).orElseThrow().session())
                .isEqualTo(new BotSession(Step.CANCEL_CONFIRM, null, null, null, appointmentB));
        assertThat(appointmentRepository.findById(appointmentA).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(appointmentRepository.findById(appointmentB).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(eventsOfAppointment(appointmentA))
                .containsExactly(new StoredEvent("appointment_created", "master"));
    }

    private static String interactiveBodyOf(JsonNode body) {
        return body.path("interactive").path("body").path("text").asString("");
    }

    private void expectReply(int step, Consumer<JsonNode> assertion) {
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertion.accept(requestJson(json, request)))
                .andRespond(withSuccess(accepted("wamid.bot-cancel-conv-" + step), APPLICATION_JSON));
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

    private List<StoredEvent> eventsOfClient(UUID clientId) {
        return jdbc.query(
                "select type, actor from events where entity_id in (select id from appointments where client_id = ?) order by created_at, id",
                (rs, rowNum) -> new StoredEvent(rs.getString("type"), rs.getString("actor")),
                clientId);
    }

    private List<StoredEvent> eventsOfAppointment(UUID appointmentId) {
        return jdbc.query(
                "select type, actor from events where entity_id = ? order by created_at, id",
                (rs, rowNum) -> new StoredEvent(rs.getString("type"), rs.getString("actor")),
                appointmentId);
    }
}
