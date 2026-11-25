package com.massagedesk.api.bot;

import static com.massagedesk.api.bot.BotConversations.bot;
import static com.massagedesk.api.bot.BotConversations.cleanUp;
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
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
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
class BookingBotDayTests {

    private static final List<String> TUESDAY_DAY_IDS = List.of(
            "day:2026-11-03",
            "day:2026-11-10",
            "day:2026-11-17",
            "day:2026-11-24",
            "day:2026-12-01");

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
    void selectingActiveServiceRepliesWithFreeDaysWithinThirtyDaysAndMovesToDayStep() {
        assertThat(jdbc.queryForObject("select count(*) from working_hours", Integer.class))
                .isEqualTo(1);
        UUID id = conversation(clients, jdbc, "+998900001201");
        sessions.save(id, new BotSession(Step.SERVICE, null, null, null, null), NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(rowIds(body)).containsExactlyElementsOf(TUESDAY_DAY_IDS);
                    JsonNode rows = body.path("interactive").path("action").path("sections").path(0).path("rows");
                    assertThat(rows.path(0).path("title").asString()).isEqualTo("Вторник, 3 ноября");
                    assertThat(rows.path(0).path("description").asString()).isEqualTo("Завтра");
                    for (int i = 1; i < rows.size(); i++) {
                        assertThat(rows.path(i).path("description").isMissingNode()).isTrue();
                    }
                })
                .andRespond(withSuccess(accepted("wamid.bot-day-1"), APPLICATION_JSON));

        bot.on(reply(id, BotReplies.SERVICE_PREFIX + serviceId));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.DAY, serviceId, null, null, null));
    }

    @Test
    void selectingFreeDayRepliesWithFirstPageOfTimesAndMovesToTimeStep() {
        UUID id = conversation(clients, jdbc, "+998900001202");
        sessions.save(id, new BotSession(Step.DAY, serviceId, null, null, null), NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(rowIds(body))
                            .containsExactly(
                                    "time:2026-11-03T05:00:00Z",
                                    "time:2026-11-03T05:30:00Z",
                                    "time:2026-11-03T06:00:00Z",
                                    "time:2026-11-03T06:30:00Z",
                                    "time:2026-11-03T07:00:00Z",
                                    "time:2026-11-03T07:30:00Z",
                                    "time:2026-11-03T08:00:00Z",
                                    "time:2026-11-03T08:30:00Z",
                                    "more_times:2026-11-03T08:30:00Z",
                                    "other_day");
                    JsonNode rows = body.path("interactive").path("action").path("sections").path(0).path("rows");
                    List<String> titles = new ArrayList<>(8);
                    for (int i = 0; i < 8; i++) {
                        titles.add(rows.path(i).path("title").asString());
                    }
                    assertThat(titles)
                            .containsExactly("10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30");
                })
                .andRespond(withSuccess(accepted("wamid.bot-day-times"), APPLICATION_JSON));

        bot.on(reply(id, "day:2026-11-03"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, serviceId, LocalDate.of(2026, 11, 3), null, null));
    }

    @Test
    void dayWithoutFreeStartsSendsNoTimeTextAndDaysWhileOutOfRangeOrFreeTextRepeatsDays() {
        UUID id = conversation(clients, jdbc, "+998900001203");
        sessions.save(id, new BotSession(Step.DAY, serviceId, null, null, null), NOW.minus(Duration.ofMinutes(1)));

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("type").asString()).isEqualTo("text");
                    assertThat(body.path("text").path("body").asString()).isEqualTo(BotReplies.NO_TIME_TEXT);
                })
                .andRespond(withSuccess(accepted("wamid.bot-no-time-text"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .containsExactlyElementsOf(TUESDAY_DAY_IDS))
                .andRespond(withSuccess(accepted("wamid.bot-no-time-days"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .containsExactlyElementsOf(TUESDAY_DAY_IDS))
                .andRespond(withSuccess(accepted("wamid.bot-out-of-range-days"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .containsExactlyElementsOf(TUESDAY_DAY_IDS))
                .andRespond(withSuccess(accepted("wamid.bot-text-days"), APPLICATION_JSON));

        bot.on(reply(id, "day:2026-11-02"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.DAY, serviceId, null, null, null));

        bot.on(reply(id, "day:2026-12-02"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.DAY, serviceId, null, null, null));

        bot.on(text(id, "завтра"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.DAY, serviceId, null, null, null));
    }

    @Test
    void noWorkingHoursRepliesWithNoDaysTextAndReturnsToMenu() {
        jdbc.update("delete from working_hours where id = ?", hoursId);
        assertThat(jdbc.queryForObject("select count(*) from working_hours", Integer.class))
                .isZero();
        UUID id = conversation(clients, jdbc, "+998900001204");
        sessions.save(id, new BotSession(Step.SERVICE, null, null, null, null), NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("type").asString()).isEqualTo("text");
                    assertThat(body.path("text").path("body").asString()).isEqualTo(BotReplies.NO_DAYS_TEXT);
                })
                .andRespond(withSuccess(accepted("wamid.bot-no-days"), APPLICATION_JSON));

        bot.on(reply(id, BotReplies.SERVICE_PREFIX + serviceId));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
    }

    @Test
    void deactivatedServiceOnDayStepFallsBackToServiceListOrNoServices() {
        UUID id = conversation(clients, jdbc, "+998900001205");
        jdbc.update("update services set active = false where id = ?", serviceId);
        UUID otherServiceId = serviceRepository
                .saveAndFlush(new MassageService("Лимфодренажный массаж", 60, new BigDecimal("9000.00"), 2))
                .getId();
        try {
            sessions.save(id, new BotSession(Step.DAY, serviceId, null, null, null), NOW.minus(Duration.ofMinutes(1)));
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                            .containsExactly(BotReplies.SERVICE_PREFIX + otherServiceId))
                    .andRespond(withSuccess(accepted("wamid.bot-day-svc-fallback"), APPLICATION_JSON));
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(body.path("type").asString()).isEqualTo("text");
                        assertThat(body.path("text").path("body").asString()).isEqualTo(BotReplies.NO_SERVICES_TEXT);
                    })
                    .andRespond(withSuccess(accepted("wamid.bot-day-no-svc"), APPLICATION_JSON));

            bot.on(reply(id, "day:2026-11-03"));
            assertThat(sessions.load(id).orElseThrow().session())
                    .isEqualTo(new BotSession(Step.SERVICE, null, null, null, null));

            jdbc.update("update services set active = false where id = ?", otherServiceId);
            assertThat(jdbc.queryForObject("select count(*) from services where active", Integer.class))
                    .isZero();
            sessions.save(id, new BotSession(Step.DAY, serviceId, null, null, null), NOW.minus(Duration.ofMinutes(1)));

            bot.on(reply(id, "day:2026-11-03"));

            server.verify();
            assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
        } finally {
            jdbc.update("delete from services where id = ?", otherServiceId);
        }
    }
}
