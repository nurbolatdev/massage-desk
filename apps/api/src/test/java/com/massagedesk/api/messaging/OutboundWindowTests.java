package com.massagedesk.api.messaging;

import static com.massagedesk.api.messaging.OutboundRows.conversation;
import static com.massagedesk.api.messaging.OutboundRows.conversationRow;
import static com.massagedesk.api.messaging.OutboundRows.count;
import static com.massagedesk.api.messaging.OutboundRows.deleteByPhoneLike;
import static com.massagedesk.api.messaging.OutboundRows.messagesOf;
import static com.massagedesk.api.messaging.TestOutboundMessages.API_URL;
import static com.massagedesk.api.messaging.TestOutboundMessages.MESSAGES_URL;
import static com.massagedesk.api.messaging.TestOutboundMessages.accepted;
import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.ClientService;
import com.massagedesk.api.messaging.OutboundMessage.Button;
import com.massagedesk.api.messaging.OutboundMessage.Buttons;
import com.massagedesk.api.messaging.OutboundMessage.ListMenu;
import com.massagedesk.api.messaging.OutboundMessage.Row;
import com.massagedesk.api.messaging.OutboundMessage.Template;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class OutboundWindowTests {

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

    @BeforeEach
    @AfterEach
    void cleanUp() {
        deleteByPhoneLike(jdbc, "+99890000112_");
    }

    @Test
    void textWhenLastInboundIsNullThrowsOutsideWindowBeforeHttp() {
        UUID id = conversation(clients, store, jdbc, "+998900001121", null);
        long messagesBefore = count(jdbc, "messages");

        assertThatThrownBy(() -> outbound.send(id, Author.BOT, new Text("Привет")))
                .isInstanceOf(OutsideWindowException.class)
                .hasNoCause();

        assertThat(count(jdbc, "messages")).isEqualTo(messagesBefore);
        assertThat(conversationRow(jdbc, id))
                .isEqualTo(new ConversationRow(id, conversationRow(jdbc, id).clientId(), null, null));
        server.verify();
    }

    @Test
    void nonTemplateMessagesAtExact24HourBoundaryThrowOutsideWindowBeforeHttp() {
        Instant boundary = NOW.minus(Duration.ofHours(24));
        UUID id = conversation(clients, store, jdbc, "+998900001122", boundary);
        long messagesBefore = count(jdbc, "messages");
        List<OutboundMessage> nonTemplates = List.of(
                new Text("Текст"),
                new Buttons("Выберите", List.of(new Button("1", "Да"))),
                new ListMenu("Услуги", "Открыть", List.of(new Row("r1", "Массаж спины", null))));

        for (OutboundMessage message : nonTemplates) {
            assertThatThrownBy(() -> outbound.send(id, Author.BOT, message))
                    .isInstanceOf(OutsideWindowException.class)
                    .hasNoCause();
        }

        assertThat(count(jdbc, "messages")).isEqualTo(messagesBefore);
        ConversationRow row = conversationRow(jdbc, id);
        assertThat(row.lastInboundAt()).isEqualTo(boundary);
        assertThat(row.lastMessageAt()).isEqualTo(boundary);
        server.verify();
    }

    @Test
    void textOneSecondBefore24HourBoundaryIsSentAndStored() {
        Instant insideBoundary = NOW.minus(Duration.ofHours(24)).plusSeconds(1);
        UUID id = conversation(clients, store, jdbc, "+998900001123", insideBoundary);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess(accepted("wamid.boundary-1"), APPLICATION_JSON));

        Sent sent = outbound.send(id, Author.BOT, new Text("Ещё в окне"));

        assertThat(messagesOf(jdbc, id)).containsExactly(new MessageRow(
                sent.messageId(), id, "out", "bot", "Ещё в окне", "wamid.boundary-1", NOW));
        ConversationRow row = conversationRow(jdbc, id);
        assertThat(row.lastInboundAt()).isEqualTo(insideBoundary);
        assertThat(row.lastMessageAt()).isEqualTo(NOW);
        server.verify();
    }

    @Test
    void templateOutsideWindowIsSentAndStoredWithNullBody() {
        UUID id = conversation(clients, store, jdbc, "+998900001124", null);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(body.path("to").asString()).isEqualTo("998900001124");
                    assertThat(body.path("type").asString()).isEqualTo("template");
                })
                .andRespond(withSuccess(accepted("wamid.tpl-1"), APPLICATION_JSON));

        Sent sent = outbound.send(id, Author.BOT, new Template("booking_reminder", "ru", List.of("10:00")));

        assertThat(sent.waMessageId()).isEqualTo("wamid.tpl-1");
        assertThat(messagesOf(jdbc, id)).containsExactly(new MessageRow(
                sent.messageId(), id, "out", "bot", null, "wamid.tpl-1", NOW));
        ConversationRow row = conversationRow(jdbc, id);
        assertThat(row.lastInboundAt()).isNull();
        assertThat(row.lastMessageAt()).isEqualTo(NOW);
        server.verify();
    }

    @Test
    void meta131047ThrowsOutsideWindowWithSendExceptionCauseWithoutStoring() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation(clients, store, jdbc, "+998900001125", inboundAt);
        long messagesBefore = count(jdbc, "messages");

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withStatus(BAD_REQUEST).contentType(APPLICATION_JSON).body("{\"error\":{\"code\":131047}}"));

        assertThatThrownBy(() -> outbound.send(id, Author.BOT, new Text("Окно закрылось у Meta")))
                .isInstanceOf(OutsideWindowException.class)
                .satisfies(ex -> {
                    assertThat(ex.getCause()).isInstanceOf(WhatsAppSendException.class);
                    WhatsAppSendException cause = (WhatsAppSendException) ex.getCause();
                    assertThat(cause.errorCode()).isEqualTo(131047);
                    assertThat(cause.reason()).isEqualTo(Reason.REJECTED);
                });

        assertThat(count(jdbc, "messages")).isEqualTo(messagesBefore);
        assertThat(conversationRow(jdbc, id).lastInboundAt()).isEqualTo(inboundAt);
        assertThat(conversationRow(jdbc, id).lastMessageAt()).isEqualTo(inboundAt);
        server.verify();
    }

    @Test
    void meta131026ThrowsWhatsAppSendExceptionNotOutsideWindowWithoutStoring() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation(clients, store, jdbc, "+998900001126", inboundAt);
        long messagesBefore = count(jdbc, "messages");

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withStatus(BAD_REQUEST).contentType(APPLICATION_JSON).body("{\"error\":{\"code\":131026}}"));

        assertThatThrownBy(() -> outbound.send(id, Author.BOT, new Text("Не доставлено")))
                .isInstanceOf(WhatsAppSendException.class)
                .isNotInstanceOf(OutsideWindowException.class)
                .satisfies(ex -> {
                    WhatsAppSendException sendEx = (WhatsAppSendException) ex;
                    assertThat(sendEx.reason()).isEqualTo(Reason.REJECTED);
                    assertThat(sendEx.errorCode()).isEqualTo(131026);
                });

        assertThat(count(jdbc, "messages")).isEqualTo(messagesBefore);
        assertThat(conversationRow(jdbc, id).lastInboundAt()).isEqualTo(inboundAt);
        assertThat(conversationRow(jdbc, id).lastMessageAt()).isEqualTo(inboundAt);
        server.verify();
    }

    @Test
    void unconfiguredClientThrowsNotConfiguredBeforeHttpWithoutStoring() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation(clients, store, jdbc, "+998900001127", inboundAt);
        long messagesBefore = count(jdbc, "messages");
        RestClient.Builder unconfiguredBuilder = RestClient.builder();
        MockRestServiceServer unconfiguredServer = MockRestServiceServer.bindTo(unconfiguredBuilder).build();
        WhatsAppApiProperties emptyTokenProps = new WhatsAppApiProperties(API_URL, "", "123456", null, null);
        OutboundMessages unconfigured = new OutboundMessages(
                store, new WhatsAppClient(unconfiguredBuilder, emptyTokenProps, json), clock);

        assertThatThrownBy(() -> unconfigured.send(id, Author.BOT, new Text("Без токена")))
                .isInstanceOf(WhatsAppSendException.class)
                .satisfies(ex -> assertThat(((WhatsAppSendException) ex).reason()).isEqualTo(Reason.NOT_CONFIGURED));

        assertThat(count(jdbc, "messages")).isEqualTo(messagesBefore);
        assertThat(conversationRow(jdbc, id).lastInboundAt()).isEqualTo(inboundAt);
        assertThat(conversationRow(jdbc, id).lastMessageAt()).isEqualTo(inboundAt);
        unconfiguredServer.verify();
        server.verify();
    }
}
