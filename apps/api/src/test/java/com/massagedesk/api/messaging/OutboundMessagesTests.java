package com.massagedesk.api.messaging;

import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.ClientService;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.ConversationStore.Recipient;
import com.massagedesk.api.messaging.OutboundMessage.Button;
import com.massagedesk.api.messaging.OutboundMessage.Buttons;
import com.massagedesk.api.messaging.OutboundMessage.ListMenu;
import com.massagedesk.api.messaging.OutboundMessage.Row;
import com.massagedesk.api.messaging.OutboundMessage.Template;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import com.massagedesk.api.messaging.OutboundMessages.Author;
import com.massagedesk.api.messaging.OutboundMessages.Sent;
import com.massagedesk.api.messaging.WhatsAppSendException.Reason;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
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

    private static final String MESSAGES_URL = "https://graph.test/v99.0/123456/messages";

    private record ConversationRow(UUID id, UUID clientId, Instant lastInboundAt, Instant lastMessageAt) {
    }

    private record MessageRow(
            UUID id,
            UUID conversationId,
            String direction,
            String author,
            String body,
            String waMessageId,
            Instant createdAt) {
    }

    @Autowired
    private ConversationStore store;

    @Autowired
    private ClientService clients;

    @Autowired
    private JdbcTemplate jdbc;

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
        outbound = new OutboundMessages(
                store,
                new WhatsAppClient(
                        builder,
                        new WhatsAppApiProperties("https://graph.test/v99.0", "test-token", "123456", null, null),
                        json),
                clock);
    }

    @Test
    void recipientOfReturnsClientPhoneAndLastInboundTimeOrEmptyWhenMissing() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID openId = conversation("+998900001101", inboundAt);
        UUID neverInboundId = conversation("+998900001102", null);

        assertThat(store.recipientOf(openId))
                .contains(new Recipient("+998900001101", inboundAt));
        assertThat(store.recipientOf(neverInboundId))
                .contains(new Recipient("+998900001102", null));
        assertThat(store.recipientOf(UUID.randomUUID())).isEmpty();
    }

    @Test
    void addOutboundStoresRowMovesLastMessageAtAndKeepsLastInboundAt() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID openId = conversation("+998900001103", inboundAt);
        UUID nullInboundId = conversation("+998900001104", null);

        Optional<UUID> firstId = store.addOutbound(openId, "bot", "Здравствуйте", "wamid.out-1", NOW);
        Optional<UUID> secondId = store.addOutbound(nullInboundId, "bot", "Напоминание", "wamid.out-2", NOW);

        assertThat(firstId).isPresent();
        assertThat(messagesOf(openId)).containsExactly(new MessageRow(
                firstId.get(), openId, "out", "bot", "Здравствуйте", "wamid.out-1", NOW));
        ConversationRow openRow = conversationRow(openId);
        assertThat(openRow.lastMessageAt()).isEqualTo(NOW);
        assertThat(openRow.lastInboundAt()).isEqualTo(inboundAt);

        assertThat(secondId).isPresent();
        assertThat(messagesOf(nullInboundId)).containsExactly(new MessageRow(
                secondId.get(), nullInboundId, "out", "bot", "Напоминание", "wamid.out-2", NOW));
        ConversationRow nullInboundRow = conversationRow(nullInboundId);
        assertThat(nullInboundRow.lastMessageAt()).isEqualTo(NOW);
        assertThat(nullInboundRow.lastInboundAt()).isNull();
    }

    @Test
    void addOutboundStoresMasterAuthorAndNullBody() {
        UUID id = conversation("+998900001105", null);

        Optional<UUID> messageId = store.addOutbound(id, "master", null, "wamid.out-3", NOW);

        assertThat(messageId).isPresent();
        assertThat(messagesOf(id)).containsExactly(new MessageRow(
                messageId.get(), id, "out", "master", null, "wamid.out-3", NOW));
    }

    @Test
    void addOutboundWithEarlierTimeDoesNotMoveLastMessageAtBackwards() {
        UUID id = conversation("+998900001106", NOW);
        Instant earlier = NOW.minus(Duration.ofMinutes(30));

        Optional<UUID> messageId = store.addOutbound(id, "bot", "Раннее", "wamid.out-4", earlier);

        assertThat(messageId).isPresent();
        ConversationRow row = conversationRow(id);
        assertThat(row.lastMessageAt()).isEqualTo(NOW);
        assertThat(row.lastInboundAt()).isEqualTo(NOW);
    }

    @Test
    void duplicateWaMessageIdWithLaterTimestampReturnsEmptyAndDoesNotMoveLastMessageAt() {
        UUID id = conversation("+998900001107", NOW.minus(Duration.ofHours(1)));
        Instant later = NOW.plus(Duration.ofMinutes(10));

        Optional<UUID> first = store.addOutbound(id, "bot", "Первое", "wamid.out-dup", NOW);
        long messagesAfterFirst = count("messages");
        Optional<UUID> duplicate = store.addOutbound(id, "bot", "Повтор", "wamid.out-dup", later);

        assertThat(first).isPresent();
        assertThat(duplicate).isEmpty();
        assertThat(count("messages")).isEqualTo(messagesAfterFirst);
        assertThat(messagesOf(id)).containsExactly(new MessageRow(
                first.get(), id, "out", "bot", "Первое", "wamid.out-dup", NOW));
        assertThat(conversationRow(id).lastMessageAt()).isEqualTo(NOW);
        assertThat(store.messageIdOf("wamid.out-dup")).isEqualTo(first.get());
    }

    @Test
    void sendsBotTextWithinWindowAndStoresMessage() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation("+998900001111", inboundAt);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(body.path("to").asString()).isEqualTo("998900001111");
                    assertThat(body.path("type").asString()).isEqualTo("text");
                })
                .andRespond(withSuccess(
                        "{\"messaging_product\":\"whatsapp\",\"messages\":[{\"id\":\"wamid.send-1\"}]}",
                        APPLICATION_JSON));

        Sent sent = outbound.send(id, Author.BOT, new Text("Запись подтверждена"));

        assertThat(sent.waMessageId()).isEqualTo("wamid.send-1");
        assertThat(messagesOf(id)).containsExactly(new MessageRow(
                sent.messageId(), id, "out", "bot", "Запись подтверждена", "wamid.send-1", NOW));
        ConversationRow row = conversationRow(id);
        assertThat(row.lastMessageAt()).isEqualTo(NOW);
        assertThat(row.lastInboundAt()).isEqualTo(inboundAt);
        server.verify();
    }

    @Test
    void sendsMasterButtonsWithinWindowAndStoresButtonsBody() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation("+998900001112", inboundAt);
        Buttons buttons = new Buttons(
                "Выберите время",
                List.of(new Button("10", "10:00"), new Button("12", "12:00")));

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess(
                        "{\"messaging_product\":\"whatsapp\",\"messages\":[{\"id\":\"wamid.send-2\"}]}",
                        APPLICATION_JSON));

        Sent sent = outbound.send(id, Author.MASTER, buttons);

        assertThat(messagesOf(id)).containsExactly(new MessageRow(
                sent.messageId(), id, "out", "master", "Выберите время", "wamid.send-2", NOW));
        server.verify();
    }

    @Test
    void meta503ThrowsUnavailableWithoutStoringOrTouchingConversation() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation("+998900001113", inboundAt);
        long messagesBefore = count("messages");

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withStatus(SERVICE_UNAVAILABLE));

        assertThatThrownBy(() -> outbound.send(id, Author.BOT, new Text("Не уйдёт")))
                .isInstanceOf(WhatsAppSendException.class)
                .satisfies(ex -> assertThat(((WhatsAppSendException) ex).reason()).isEqualTo(Reason.UNAVAILABLE));

        assertThat(count("messages")).isEqualTo(messagesBefore);
        assertThat(conversationRow(id).lastMessageAt()).isEqualTo(inboundAt);
        server.verify();
    }

    @Test
    void twoSendsReturningSameWaMessageIdReturnSameMessageIdAndStoreSingleRow() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation("+998900001114", inboundAt);
        String okBody = "{\"messaging_product\":\"whatsapp\",\"messages\":[{\"id\":\"wamid.send-dup\"}]}";

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess(okBody, APPLICATION_JSON));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess(okBody, APPLICATION_JSON));

        Sent first = outbound.send(id, Author.BOT, new Text("Первое"));
        Sent second = outbound.send(id, Author.BOT, new Text("Второе"));

        assertThat(second).isEqualTo(first);
        assertThat(messagesOf(id)).containsExactly(new MessageRow(
                first.messageId(), id, "out", "bot", "Первое", "wamid.send-dup", NOW));
        server.verify();
    }

    @Test
    void unknownConversationThrowsIllegalArgumentBeforeHttp() {
        UUID unknownId = UUID.randomUUID();
        long messagesBefore = count("messages");

        assertThatThrownBy(() -> outbound.send(unknownId, Author.BOT, new Text("Кому?")))
                .isInstanceOf(IllegalArgumentException.class)
                .satisfies(ex -> assertThat(ex.getMessage())
                        .isEqualTo("unknown conversation")
                        .doesNotContain(unknownId.toString()));

        assertThat(count("messages")).isEqualTo(messagesBefore);
        server.verify();
    }

    @Test
    void textWhenLastInboundIsNullThrowsOutsideWindowBeforeHttp() {
        UUID id = conversation("+998900001121", null);
        long messagesBefore = count("messages");

        assertThatThrownBy(() -> outbound.send(id, Author.BOT, new Text("Привет")))
                .isInstanceOf(OutsideWindowException.class)
                .hasNoCause();

        assertThat(count("messages")).isEqualTo(messagesBefore);
        assertThat(conversationRow(id)).isEqualTo(new ConversationRow(id, conversationRow(id).clientId(), null, null));
        server.verify();
    }

    @Test
    void nonTemplateMessagesAtExact24HourBoundaryThrowOutsideWindowBeforeHttp() {
        Instant boundary = NOW.minus(Duration.ofHours(24));
        UUID id = conversation("+998900001122", boundary);
        long messagesBefore = count("messages");
        List<OutboundMessage> nonTemplates = List.of(
                new Text("Текст"),
                new Buttons("Выберите", List.of(new Button("1", "Да"))),
                new ListMenu("Услуги", "Открыть", List.of(new Row("r1", "Массаж спины", null))));

        for (OutboundMessage message : nonTemplates) {
            assertThatThrownBy(() -> outbound.send(id, Author.BOT, message))
                    .isInstanceOf(OutsideWindowException.class)
                    .hasNoCause();
        }

        assertThat(count("messages")).isEqualTo(messagesBefore);
        ConversationRow row = conversationRow(id);
        assertThat(row.lastInboundAt()).isEqualTo(boundary);
        assertThat(row.lastMessageAt()).isEqualTo(boundary);
        server.verify();
    }

    @Test
    void textOneSecondBefore24HourBoundaryIsSentAndStored() {
        Instant insideBoundary = NOW.minus(Duration.ofHours(24)).plusSeconds(1);
        UUID id = conversation("+998900001123", insideBoundary);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess(
                        "{\"messaging_product\":\"whatsapp\",\"messages\":[{\"id\":\"wamid.boundary-1\"}]}",
                        APPLICATION_JSON));

        Sent sent = outbound.send(id, Author.BOT, new Text("Ещё в окне"));

        assertThat(messagesOf(id)).containsExactly(new MessageRow(
                sent.messageId(), id, "out", "bot", "Ещё в окне", "wamid.boundary-1", NOW));
        ConversationRow row = conversationRow(id);
        assertThat(row.lastInboundAt()).isEqualTo(insideBoundary);
        assertThat(row.lastMessageAt()).isEqualTo(NOW);
        server.verify();
    }

    @Test
    void templateOutsideWindowIsSentAndStoredWithNullBody() {
        UUID id = conversation("+998900001124", null);

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(body.path("to").asString()).isEqualTo("998900001124");
                    assertThat(body.path("type").asString()).isEqualTo("template");
                })
                .andRespond(withSuccess(
                        "{\"messaging_product\":\"whatsapp\",\"messages\":[{\"id\":\"wamid.tpl-1\"}]}",
                        APPLICATION_JSON));

        Sent sent = outbound.send(id, Author.BOT, new Template("booking_reminder", "ru", List.of("10:00")));

        assertThat(sent.waMessageId()).isEqualTo("wamid.tpl-1");
        assertThat(messagesOf(id)).containsExactly(new MessageRow(
                sent.messageId(), id, "out", "bot", null, "wamid.tpl-1", NOW));
        ConversationRow row = conversationRow(id);
        assertThat(row.lastInboundAt()).isNull();
        assertThat(row.lastMessageAt()).isEqualTo(NOW);
        server.verify();
    }

    @Test
    void meta131047ThrowsOutsideWindowWithSendExceptionCauseWithoutStoring() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation("+998900001125", inboundAt);
        long messagesBefore = count("messages");

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

        assertThat(count("messages")).isEqualTo(messagesBefore);
        assertThat(conversationRow(id).lastInboundAt()).isEqualTo(inboundAt);
        assertThat(conversationRow(id).lastMessageAt()).isEqualTo(inboundAt);
        server.verify();
    }

    @Test
    void meta131026ThrowsWhatsAppSendExceptionNotOutsideWindowWithoutStoring() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation("+998900001126", inboundAt);
        long messagesBefore = count("messages");

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

        assertThat(count("messages")).isEqualTo(messagesBefore);
        assertThat(conversationRow(id).lastInboundAt()).isEqualTo(inboundAt);
        assertThat(conversationRow(id).lastMessageAt()).isEqualTo(inboundAt);
        server.verify();
    }

    @Test
    void unconfiguredClientThrowsNotConfiguredBeforeHttpWithoutStoring() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID id = conversation("+998900001127", inboundAt);
        long messagesBefore = count("messages");
        RestClient.Builder unconfiguredBuilder = RestClient.builder();
        MockRestServiceServer unconfiguredServer = MockRestServiceServer.bindTo(unconfiguredBuilder).build();
        WhatsAppApiProperties emptyTokenProps = new WhatsAppApiProperties("https://graph.test/v99.0", "", "123456", null, null);
        OutboundMessages unconfigured = new OutboundMessages(
                store, new WhatsAppClient(unconfiguredBuilder, emptyTokenProps, json), clock);

        assertThatThrownBy(() -> unconfigured.send(id, Author.BOT, new Text("Без токена")))
                .isInstanceOf(WhatsAppSendException.class)
                .satisfies(ex -> assertThat(((WhatsAppSendException) ex).reason()).isEqualTo(Reason.NOT_CONFIGURED));

        assertThat(count("messages")).isEqualTo(messagesBefore);
        assertThat(conversationRow(id).lastInboundAt()).isEqualTo(inboundAt);
        assertThat(conversationRow(id).lastMessageAt()).isEqualTo(inboundAt);
        unconfiguredServer.verify();
        server.verify();
    }

    private UUID conversation(String phone, @Nullable Instant lastInboundAt) {
        UUID clientId = clients.findOrCreate(phone, "Aziza", EventActor.CLIENT);
        UUID id = store.conversationOf(clientId);
        OffsetDateTime at = lastInboundAt == null ? null : lastInboundAt.atOffset(ZoneOffset.UTC);
        jdbc.update(
                """
                update conversations
                set last_inbound_at = cast(? as timestamptz),
                    last_message_at = cast(? as timestamptz)
                where id = ?""",
                at,
                at,
                id);
        return id;
    }

    private ConversationRow conversationRow(UUID conversationId) {
        return jdbc.queryForObject(
                "select id, client_id, last_inbound_at, last_message_at from conversations where id = ?",
                (rs, rowNum) -> new ConversationRow(
                        rs.getObject("id", UUID.class),
                        rs.getObject("client_id", UUID.class),
                        instant(rs, "last_inbound_at"),
                        instant(rs, "last_message_at")),
                conversationId);
    }

    private List<MessageRow> messagesOf(UUID conversationId) {
        return jdbc.query(
                """
                select id, conversation_id, direction, author, body, wa_message_id, created_at
                from messages
                where conversation_id = ?
                order by created_at, id""",
                (rs, rowNum) -> new MessageRow(
                        rs.getObject("id", UUID.class),
                        rs.getObject("conversation_id", UUID.class),
                        rs.getString("direction"),
                        rs.getString("author"),
                        rs.getString("body"),
                        rs.getString("wa_message_id"),
                        instant(rs, "created_at")),
                conversationId);
    }

    private long count(String table) {
        return jdbc.queryForObject("select count(*) from " + table, Long.class);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime odt = rs.getObject(column, OffsetDateTime.class);
        return odt == null ? null : odt.toInstant();
    }
}
