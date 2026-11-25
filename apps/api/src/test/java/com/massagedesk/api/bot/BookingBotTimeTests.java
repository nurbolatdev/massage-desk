package com.massagedesk.api.bot;

import static com.massagedesk.api.bot.BotConversations.bot;
import static com.massagedesk.api.bot.BotConversations.buttonIds;
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
class BookingBotTimeTests {

    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 3);
    private static final List<String> FIRST_PAGE_TIME_IDS = List.of(
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
    void selectingFreeTimeRepliesWithConfirmationButtonsAndMovesToConfirmStep() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        Instant start = Instant.parse("2026-11-03T05:00:00Z");
        sessions.save(id, new BotSession(Step.TIME, serviceId, TUESDAY, null, null), NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("interactive").path("type").asString()).isEqualTo("button");
                    assertThat(body.path("interactive").path("body").path("text").asString())
                            .isEqualTo(
                                    "Проверьте запись:\nКлассический массаж\nВторник, 3 ноября, 10:00\n60\u00a0мин · 8\u00a0000\u00a0₸");
                    assertThat(buttonIds(body))
                            .containsExactly("confirm:" + serviceId + ":" + start, "other_time");
                })
                .andRespond(withSuccess(accepted("wamid.bot-time-confirm"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "time:2026-11-03T05:00:00Z"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.CONFIRM, serviceId, TUESDAY, start, null));
    }

    @Test
    void moreTimesShowsRemainingStartsAndWrapsToFirstPageWhenNoneRemainAfter() {
        UUID id = conversation(clients, jdbc, "+998900001202");
        sessions.save(id, new BotSession(Step.TIME, serviceId, TUESDAY, null, null), NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(rowIds(body))
                            .containsExactly(
                                    "time:2026-11-03T09:00:00Z",
                                    "time:2026-11-03T09:30:00Z",
                                    "time:2026-11-03T10:00:00Z",
                                    "other_day");
                    JsonNode rows = body.path("interactive").path("action").path("sections").path(0).path("rows");
                    List<String> titles = new ArrayList<>(3);
                    for (int i = 0; i < 3; i++) {
                        titles.add(rows.path(i).path("title").asString());
                    }
                    assertThat(titles).containsExactly("14:00", "14:30", "15:00");
                })
                .andRespond(withSuccess(accepted("wamid.bot-more-times-page2"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .containsExactlyElementsOf(FIRST_PAGE_TIME_IDS))
                .andRespond(withSuccess(accepted("wamid.bot-more-times-wrap"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "more_times:2026-11-03T08:30:00Z"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, serviceId, TUESDAY, null, null));

        bot.on(reply(jdbc, id, "more_times:2026-11-03T10:00:00Z"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, serviceId, TUESDAY, null, null));
    }

    @Test
    void takenOrOffGridTimeSendsTimeTakenTextAndRefreshedTimeList() {
        UUID id = conversation(clients, jdbc, "+998900001203");
        Client competitor = clients.saveAndFlush(new Client("+998900001209", "Other client"));
        appointments.create(
                competitor.getId(),
                serviceId,
                Instant.parse("2026-11-03T05:00:00Z"),
                AppointmentSource.MANUAL,
                EventActor.MASTER);
        sessions.save(id, new BotSession(Step.TIME, serviceId, TUESDAY, null, null), NOW.minus(Duration.ofMinutes(1)));

        for (int attempt = 1; attempt <= 2; attempt++) {
            int currentAttempt = attempt;
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(body.path("type").asString()).isEqualTo("text");
                        assertThat(body.path("text").path("body").asString()).isEqualTo(BotReplies.TIME_TAKEN_TEXT);
                    })
                    .andRespond(withSuccess(accepted("wamid.bot-taken-text-" + currentAttempt), APPLICATION_JSON));
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        List<String> ids = rowIds(requestJson(json, request));
                        assertThat(ids).doesNotContain("time:2026-11-03T05:00:00Z", "time:2026-11-03T05:30:00Z");
                        assertThat(ids.get(0)).isEqualTo("time:2026-11-03T06:00:00Z");
                    })
                    .andRespond(withSuccess(accepted("wamid.bot-taken-list-" + currentAttempt), APPLICATION_JSON));
        }

        bot.on(reply(jdbc, id, "time:2026-11-03T05:00:00Z"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, serviceId, TUESDAY, null, null));

        bot.on(reply(jdbc, id, "time:2026-11-03T05:10:00Z"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, serviceId, TUESDAY, null, null));
    }

    @Test
    void otherDayReturnsToDaysAndFreeTextRepeatsTimeList() {
        UUID id = conversation(clients, jdbc, "+998900001204");
        sessions.save(id, new BotSession(Step.TIME, serviceId, TUESDAY, null, null), NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .containsExactly(
                                "day:2026-11-03",
                                "day:2026-11-10",
                                "day:2026-11-17",
                                "day:2026-11-24",
                                "day:2026-12-01"))
                .andRespond(withSuccess(accepted("wamid.bot-other-day"), APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .containsExactlyElementsOf(FIRST_PAGE_TIME_IDS))
                .andRespond(withSuccess(accepted("wamid.bot-text-times"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "other_day"));
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.DAY, serviceId, null, null, null));

        sessions.save(id, new BotSession(Step.TIME, serviceId, TUESDAY, null, null), NOW.minus(Duration.ofMinutes(1)));
        bot.on(text(jdbc, id, "в 10"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.TIME, serviceId, TUESDAY, null, null));
    }

    @Test
    void timeFromAnotherDayRepeatsSessionDayListWithoutTimeTakenText() {
        UUID id = conversation(clients, jdbc, "+998900001205");
        BotSession timeSession = new BotSession(Step.TIME, serviceId, TUESDAY, null, null);
        sessions.save(id, timeSession, NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .containsExactlyElementsOf(FIRST_PAGE_TIME_IDS))
                .andRespond(withSuccess(accepted("wamid.bot-other-day-time"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "time:2026-11-10T05:00:00Z"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(timeSession);
    }
}
