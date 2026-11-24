package com.massagedesk.api.bot;

import static com.massagedesk.api.bot.BotConversations.buttonIds;
import static com.massagedesk.api.bot.BotConversations.cleanUp;
import static com.massagedesk.api.bot.BotConversations.conversation;
import static com.massagedesk.api.bot.BotConversations.messagesOf;
import static com.massagedesk.api.bot.BotConversations.reply;
import static com.massagedesk.api.bot.BotConversations.requestJson;
import static com.massagedesk.api.bot.BotConversations.rowIds;
import static com.massagedesk.api.bot.BotConversations.sessionOf;
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
import com.massagedesk.api.bot.BotConversations.SessionRow;
import com.massagedesk.api.bot.BotConversations.StoredMessage;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.messaging.TestOutboundMessages;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.ServiceCatalog;
import com.massagedesk.api.settings.SettingsService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class BookingBotServiceListTests {

    @Autowired private SettingsService settings;
    @Autowired private BotSessionStore sessions;
    @Autowired private ServiceCatalog catalog;
    @Autowired private MassageServiceRepository serviceRepository;
    @Autowired private ClientRepository clients;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JdbcClient jdbcClient;
    @Autowired private Clock clock;
    @Autowired private JsonMapper json;

    private MockRestServiceServer server;
    private BookingBot bot;
    private UUID activeServiceId;
    private UUID inactiveServiceId;

    @BeforeEach
    void setUp() {
        cleanUp(jdbc);
        activeServiceId = serviceRepository
                .saveAndFlush(new MassageService("Классический массаж", 60, new BigDecimal("8000.00"), 1))
                .getId();
        MassageService inactive = new MassageService("Спортивный массаж", 90, new BigDecimal("12000.00"), 2);
        inactive.deactivate();
        inactiveServiceId = serviceRepository.saveAndFlush(inactive).getId();

        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        bot = new BookingBot(
                settings, sessions, catalog, TestOutboundMessages.create(jdbcClient, builder, json, clock), clock);
    }

    @AfterEach
    void tearDown() {
        cleanUp(jdbc);
        jdbc.update("delete from services where id in (?, ?)", activeServiceId, inactiveServiceId);
    }

    @Test
    void bookButtonInMenuRepliesWithActiveServiceListAndMovesToServiceStep() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        sessions.save(id, BotSession.menu(), NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .contains(BotReplies.SERVICE_PREFIX + activeServiceId)
                        .doesNotContain(BotReplies.SERVICE_PREFIX + inactiveServiceId))
                .andRespond(withSuccess(accepted("wamid.bot-svc-1"), APPLICATION_JSON));

        bot.on(reply(id, BotReplies.BOOK));

        server.verify();
        assertThat(sessionOf(jdbc, id)).contains(new SessionRow("service", NOW));
        assertThat(messagesOf(jdbc, id)).containsExactly(new StoredMessage("out", "bot", BotReplies.SERVICES_TEXT));
    }

    @Test
    void serviceStepRepeatsServiceListOnFreeTextOrServiceRowTapAndWhileAliveAtTwentyThreeHours() {
        UUID id = conversation(clients, jdbc, "+998900001202");
        sessions.save(id, new BotSession(Step.SERVICE, null, null, null, null), NOW.minus(Duration.ofHours(23)));
        for (int i = 1; i <= 2; i++) {
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                            .contains(BotReplies.SERVICE_PREFIX + activeServiceId))
                    .andRespond(withSuccess(accepted("wamid.bot-svc-repeat-" + i), APPLICATION_JSON));
        }

        bot.on(text(id, "хочу массаж"));
        assertThat(sessionOf(jdbc, id)).contains(new SessionRow("service", NOW));

        bot.on(reply(id, BotReplies.SERVICE_PREFIX + activeServiceId));

        server.verify();
        assertThat(sessionOf(jdbc, id)).contains(new SessionRow("service", NOW));
    }

    @Test
    void bookButtonWhenNoServicesAreActiveRepliesWithNoServicesTextAndStaysInMenu() {
        UUID id = conversation(clients, jdbc, "+998900001203");
        jdbc.update("update services set active = false where id = ?", activeServiceId);
        assertThat(jdbc.queryForObject("select count(*) from services where active", Integer.class))
                .isZero();
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("type").asString()).isEqualTo("text");
                    assertThat(body.path("text").path("body").asString()).isEqualTo(BotReplies.NO_SERVICES_TEXT);
                })
                .andRespond(withSuccess(accepted("wamid.bot-no-svc"), APPLICATION_JSON));

        bot.on(reply(id, BotReplies.BOOK));

        server.verify();
        assertThat(sessionOf(jdbc, id)).contains(new SessionRow("menu", NOW));
        assertThat(messagesOf(jdbc, id)).containsExactly(new StoredMessage("out", "bot", BotReplies.NO_SERVICES_TEXT));
    }

    @Test
    void nonBookInputInMenuRepliesWithMenu() {
        UUID id = conversation(clients, jdbc, "+998900001204");
        sessions.save(id, BotSession.menu(), NOW.minus(Duration.ofMinutes(1)));
        for (int i = 1; i <= 2; i++) {
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> assertThat(buttonIds(requestJson(json, request))).containsExactly("book"))
                    .andRespond(withSuccess(accepted("wamid.bot-menu-" + i), APPLICATION_JSON));
        }

        bot.on(reply(id, BotReplies.SERVICE_PREFIX + activeServiceId));
        assertThat(sessionOf(jdbc, id)).contains(new SessionRow("menu", NOW));

        bot.on(text(id, "запишите меня"));

        server.verify();
        assertThat(sessionOf(jdbc, id)).contains(new SessionRow("menu", NOW));
    }
}
