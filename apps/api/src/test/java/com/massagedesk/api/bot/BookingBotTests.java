package com.massagedesk.api.bot;

import static com.massagedesk.api.bot.BotConversations.buttonIds;
import static com.massagedesk.api.bot.BotConversations.cleanUp;
import static com.massagedesk.api.bot.BotConversations.conversation;
import static com.massagedesk.api.bot.BotConversations.messagesOf;
import static com.massagedesk.api.bot.BotConversations.reply;
import static com.massagedesk.api.bot.BotConversations.requestJson;
import static com.massagedesk.api.bot.BotConversations.sessionOf;
import static com.massagedesk.api.bot.BotConversations.text;
import static com.massagedesk.api.messaging.TestOutboundMessages.MESSAGES_URL;
import static com.massagedesk.api.messaging.TestOutboundMessages.accepted;
import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.bot.BotConversations.SessionRow;
import com.massagedesk.api.bot.BotConversations.StoredMessage;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.messaging.TestOutboundMessages;
import com.massagedesk.api.messaging.WhatsAppSendException;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.settings.SettingsService;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class BookingBotTests {

    @Autowired private SettingsService settings;
    @Autowired private BotSessionStore sessions;
    @Autowired private ClientRepository clients;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JdbcClient jdbcClient;
    @Autowired private Clock clock;
    @Autowired private JsonMapper json;
    @Autowired private ApplicationEventPublisher events;

    private MockRestServiceServer server;
    private BookingBot bot;

    @BeforeEach
    void setUp() {
        cleanUp(jdbc);
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        bot = new BookingBot(settings, sessions, TestOutboundMessages.create(jdbcClient, builder, json, clock), clock);
    }

    @AfterEach
    void tearDown() {
        cleanUp(jdbc);
    }

    @Test
    void firstClientMessageRepliesWithMenuAndSavesMenuSession() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(buttonIds(requestJson(json, request))).containsExactly("book"))
                .andRespond(withSuccess(accepted("wamid.bot-1"), APPLICATION_JSON));

        bot.on(text(id, "Здравствуйте"));

        server.verify();
        assertThat(sessionOf(jdbc, id)).contains(new SessionRow("menu", NOW));
        assertThat(messagesOf(jdbc, id)).containsExactly(new StoredMessage("out", "bot", BotReplies.MENU_TEXT));
    }

    @Test
    void silentWhenBotIsDisabledHumanModeIsOnOrConversationIsUnknown() {
        UUID offConv = conversation(clients, jdbc, "+998900001202");
        jdbc.update("update settings set bot_enabled = false");
        bot.on(text(offConv, "Здравствуйте"));
        assertThat(sessionOf(jdbc, offConv)).isEmpty();

        jdbc.update("update settings set bot_enabled = true");
        UUID humanConv = conversation(clients, jdbc, "+998900001203", true);
        bot.on(text(humanConv, "Здравствуйте"));
        bot.on(text(UUID.randomUUID(), "Здравствуйте"));

        server.verify();
        assertThat(sessionOf(jdbc, humanConv)).isEmpty();
    }

    @Test
    void sessionAtTwentyFourHoursRestartsFromMenu() {
        UUID id = conversation(clients, jdbc, "+998900001204");
        sessions.save(id, new BotSession(Step.SERVICE, null, null, null, null), NOW.minus(Duration.ofHours(24)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(buttonIds(requestJson(json, request))).containsExactly("book"))
                .andRespond(withSuccess(accepted("wamid.bot-2"), APPLICATION_JSON));

        bot.on(reply(id, "book"));

        server.verify();
        assertThat(sessionOf(jdbc, id)).contains(new SessionRow("menu", NOW));
    }

    @Test
    void sendFailureKeepsSavedSession() {
        UUID id = conversation(clients, jdbc, "+998900001205");
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withStatus(SERVICE_UNAVAILABLE));

        assertThatThrownBy(() -> bot.on(text(id, "Здравствуйте")))
                .isInstanceOf(WhatsAppSendException.class);

        server.verify();
        assertThat(sessionOf(jdbc, id)).contains(new SessionRow("menu", NOW));
    }

    @Test
    void publishedEventReachesSpringListenerAndSavesSession() {
        UUID id = conversation(clients, jdbc, "+998900001206");

        catchThrowable(() -> events.publishEvent(text(id, "Здравствуйте")));

        assertThat(sessionOf(jdbc, id)).contains(new SessionRow("menu", NOW));
    }
}
