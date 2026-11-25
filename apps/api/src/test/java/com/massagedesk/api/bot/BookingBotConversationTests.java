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
import com.massagedesk.api.bot.BotConversations.StoredMessage;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.clients.ClientRepository;
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
class BookingBotConversationTests {

    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 3);
    private static final Instant START_14_00 = Instant.parse("2026-11-03T09:00:00Z");
    private static final Instant END_15_00 = Instant.parse("2026-11-03T10:00:00Z");
    private static final String CONFIRMATION_TEXT =
            "Проверьте запись:\nКлассический массаж\nВторник, 3 ноября, 14:00\n60\u00a0мин · 8\u00a0000\u00a0₸";
    private static final String BOOKED_TEXT =
            "Вы записаны:\nКлассический массаж\nВторник, 3 ноября, 14:00\n60\u00a0мин · 8\u00a0000\u00a0₸\nЖдём вас!";

    private record StoredAppointment(Instant startAt, Instant endAt, String source, String status) {}

    @Autowired private ApplicationContext context;
    @Autowired private BotSessionStore sessions;
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
    void fullConversationFromGreetingToConfirmedBooking() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        AtomicReference<String> nextReplyId = new AtomicReference<>();

        expectReply(1, body -> {
            assertThat(buttonIds(body)).containsExactly("book");
            nextReplyId.set(buttonIds(body).get(0));
        });
        expectReply(2, body -> {
            assertThat(rowIds(body)).containsExactly(BotReplies.SERVICE_PREFIX + serviceId);
            nextReplyId.set(rowIds(body).get(0));
        });
        expectReply(3, body -> {
            assertThat(rowIds(body)).first().isEqualTo("day:2026-11-03");
            nextReplyId.set(rowIds(body).get(0));
        });
        expectReply(4, body -> {
            assertThat(rowIds(body)).hasSize(10).element(8).isEqualTo("more_times:2026-11-03T08:30:00Z");
            nextReplyId.set(rowIds(body).get(8));
        });
        expectReply(5, body -> {
            assertThat(rowIds(body)).containsExactly(
                    "time:2026-11-03T09:00:00Z",
                    "time:2026-11-03T09:30:00Z",
                    "time:2026-11-03T10:00:00Z",
                    "other_day");
            nextReplyId.set(rowIds(body).get(0));
        });
        expectReply(6, body -> {
            assertThat(body.path("interactive").path("body").path("text").asString())
                    .isEqualTo(CONFIRMATION_TEXT)
                    .contains("Вторник, 3 ноября, 14:00");
            assertThat(buttonIds(body)).containsExactly("confirm:2026-11-03T09:00:00Z", "other_time");
            nextReplyId.set(buttonIds(body).get(0));
        });
        expectReply(7, body -> {
            assertThat(body.path("type").asString()).isEqualTo("text");
            assertThat(body.path("text").path("body").asString())
                    .isEqualTo(BOOKED_TEXT)
                    .contains("Вторник, 3 ноября, 14:00");
        });

        bot.on(text(jdbc, id, "Здравствуйте"));
        for (int turn = 0; turn < 6; turn++) {
            String replyId = nextReplyId.getAndSet(null);
            assertThat(replyId).isNotNull();
            bot.on(reply(jdbc, id, replyId));
        }

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentsOf(clientIdOf(jdbc, id)))
                .containsExactly(new StoredAppointment(START_14_00, END_15_00, "bot", "confirmed"));
        List<StoredMessage> messages = messagesOf(jdbc, id);
        assertThat(messages).hasSize(7).allSatisfy(m -> {
            assertThat(m.direction()).isEqualTo("out");
            assertThat(m.author()).isEqualTo("bot");
        });
    }

    @RepeatedTest(5)
    void concurrentConfirmTapsCreateSingleAppointmentAndSingleEvent() throws Exception {
        configureBot(true);
        UUID id = conversation(clients, jdbc, "+998900001202");
        sessions.save(
                id,
                new BotSession(Step.CONFIRM, serviceId, TUESDAY, START_14_00, null),
                NOW.minus(Duration.ofMinutes(1)));
        AtomicInteger sequence = new AtomicInteger();
        Queue<JsonNode> bodies = new ConcurrentLinkedQueue<>();
        server.expect(ExpectedCount.times(2), requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> bodies.add(requestJson(json, request)))
                .andRespond(request -> withSuccess(
                                accepted("wamid.bot-concurrent-" + sequence.incrementAndGet()),
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
                    bot.on(reply(jdbc, id, "confirm:" + START_14_00));
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
                .hasSize(2)
                .anySatisfy(body -> assertThat(textOf(body)).isEqualTo(BOOKED_TEXT))
                .noneSatisfy(body -> assertThat(textOf(body)).isEqualTo(BotReplies.TIME_TAKEN_TEXT))
                .allSatisfy(body -> assertThat(
                                BOOKED_TEXT.equals(textOf(body)) || buttonIds(body).equals(List.of("book")))
                        .isTrue());
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        assertThat(appointmentsOf(clientIdOf(jdbc, id)))
                .containsExactly(new StoredAppointment(START_14_00, END_15_00, "bot", "confirmed"));
        assertThat(createdEventsCount(clientIdOf(jdbc, id))).isEqualTo(1);
    }

    private static String textOf(JsonNode body) {
        return body.path("text").path("body").asString("");
    }

    private void expectReply(int step, Consumer<JsonNode> assertion) {
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertion.accept(requestJson(json, request)))
                .andRespond(withSuccess(accepted("wamid.bot-conv-" + step), APPLICATION_JSON));
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

    private int createdEventsCount(UUID clientId) {
        return jdbc.queryForObject(
                """
                select count(*) from events
                where type = 'appointment_created' and actor = 'bot'
                  and entity_id in (select id from appointments where client_id = ?)""",
                Integer.class,
                clientId);
    }
}
