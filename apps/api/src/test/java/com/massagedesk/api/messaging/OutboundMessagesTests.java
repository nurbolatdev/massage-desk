package com.massagedesk.api.messaging;

import static com.massagedesk.api.messaging.OutboundRows.conversation;
import static com.massagedesk.api.messaging.OutboundRows.conversationRow;
import static com.massagedesk.api.messaging.OutboundRows.count;
import static com.massagedesk.api.messaging.OutboundRows.messagesOf;
import static com.massagedesk.api.messaging.TestOutboundMessages.MESSAGES_URL;
import static com.massagedesk.api.messaging.TestOutboundMessages.accepted;
import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.ClientService;
import com.massagedesk.api.messaging.OutboundMessage.Button;
import com.massagedesk.api.messaging.OutboundMessage.Buttons;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import com.massagedesk.api.messaging.OutboundMessages.Author;
import com.massagedesk.api.messaging.OutboundMessages.Sent;
import com.massagedesk.api.messaging.OutboundRows.ConversationRow;
import com.massagedesk.api.messaging.OutboundRows.MessageRow;
import com.massagedesk.api.messaging.WhatsAppSendException.Reason;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class OutboundMessagesTests {

    @Autowired
    private ConversationStore store;

    @Autowired
    private ClientService clients;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private JdbcClient jdbcClient;

    @Autowired
    private Clock clock;

    @Autowired
    private JsonMapper json;

    private MockRestServiceServer server;
    private OutboundMessages outbound;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        outbound = TestOutboundMessages.create(jdbcClient, builder, json, clock);
    }

    @Test
    void sendsBotTextWithinWindowAndStoresMessage() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation(clients, store, jdbc, "+998900001111", inboundAt);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(body.path("to").asString()).isEqualTo("998900001111");
                    assertThat(body.path("type").asString()).isEqualTo("text");
                })
                .andRespond(withSuccess(accepted("wamid.send-1"), APPLICATION_JSON));

        Sent sent = outbound.send(id, Author.BOT, new Text("Запись подтверждена"));

        assertThat(sent.waMessageId()).isEqualTo("wamid.send-1");
        assertThat(messagesOf(jdbc, id)).containsExactly(new MessageRow(
                sent.messageId(), id, "out", "bot", "Запись подтверждена", "wamid.send-1", NOW));
        ConversationRow row = conversationRow(jdbc, id);
        assertThat(row.lastMessageAt()).isEqualTo(NOW);
        assertThat(row.lastInboundAt()).isEqualTo(inboundAt);
        server.verify();
    }

    @Test
    void sendsMasterButtonsWithinWindowAndStoresButtonsBody() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation(clients, store, jdbc, "+998900001112", inboundAt);
        Buttons buttons = new Buttons(
                "Выберите время",
                List.of(new Button("10", "10:00"), new Button("12", "12:00")));

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess(accepted("wamid.send-2"), APPLICATION_JSON));

        Sent sent = outbound.send(id, Author.MASTER, buttons);

        assertThat(messagesOf(jdbc, id)).containsExactly(new MessageRow(
                sent.messageId(), id, "out", "master", "Выберите время", "wamid.send-2", NOW));
        server.verify();
    }

    @Test
    void meta503ThrowsUnavailableWithoutStoringOrTouchingConversation() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation(clients, store, jdbc, "+998900001113", inboundAt);
        long messagesBefore = count(jdbc, "messages");

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withStatus(SERVICE_UNAVAILABLE));

        assertThatThrownBy(() -> outbound.send(id, Author.BOT, new Text("Не уйдёт")))
                .isInstanceOf(WhatsAppSendException.class)
                .satisfies(ex -> assertThat(((WhatsAppSendException) ex).reason()).isEqualTo(Reason.UNAVAILABLE));

        assertThat(count(jdbc, "messages")).isEqualTo(messagesBefore);
        assertThat(conversationRow(jdbc, id).lastMessageAt()).isEqualTo(inboundAt);
        server.verify();
    }

    @Test
    void twoSendsReturningSameWaMessageIdReturnSameMessageIdAndStoreSingleRow() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation(clients, store, jdbc, "+998900001114", inboundAt);
        String okBody = accepted("wamid.send-dup");

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess(okBody, APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess(okBody, APPLICATION_JSON));

        Sent first = outbound.send(id, Author.BOT, new Text("Первое"));
        Sent second = outbound.send(id, Author.BOT, new Text("Второе"));

        assertThat(second).isEqualTo(first);
        assertThat(messagesOf(jdbc, id)).containsExactly(new MessageRow(
                first.messageId(), id, "out", "bot", "Первое", "wamid.send-dup", NOW));
        server.verify();
    }

    @Test
    void unknownConversationThrowsIllegalArgumentBeforeHttp() {
        UUID unknownId = UUID.randomUUID();
        long messagesBefore = count(jdbc, "messages");

        assertThatThrownBy(() -> outbound.send(unknownId, Author.BOT, new Text("Кому?")))
                .isInstanceOf(IllegalArgumentException.class)
                .satisfies(ex -> assertThat(ex.getMessage())
                        .isEqualTo("unknown conversation")
                        .doesNotContain(unknownId.toString()));

        assertThat(count(jdbc, "messages")).isEqualTo(messagesBefore);
        server.verify();
    }
}
