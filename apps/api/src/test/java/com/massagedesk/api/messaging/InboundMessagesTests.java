package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.ClientService;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.InboundMessages.Stored;
import com.massagedesk.api.messaging.WebhookPayload.InboundMessage;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import jakarta.persistence.EntityManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class InboundMessagesTests {

    private record ConversationRow(UUID id, UUID clientId, Instant lastInboundAt, Instant lastMessageAt) {
    }

    private record MessageRow(
            UUID conversationId,
            String direction,
            String author,
            String body,
            String waMessageId,
            Instant createdAt) {
    }

    @Autowired
    private InboundMessages inbound;

    @Autowired
    private ClientService clients;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void newClientTextMessageCreatesClientConversationMessageAndMovesWindow() {
        Instant sentAt = Instant.parse("2026-11-01T10:00:00Z");

        Stored stored = inbound.store(List.of(new InboundMessage(
                "wamid.store-1",
                "998900000981",
                "Aziza",
                "text",
                "Здравствуйте!",
                sentAt)));

        assertThat(stored).isEqualTo(new Stored(1, 0));

        Map<String, Object> client = jdbc.queryForMap(
                "select id, phone, name from clients where phone = ?",
                "+998900000981");
        UUID clientId = (UUID) client.get("id");
        assertThat(client)
                .containsEntry("phone", "+998900000981")
                .containsEntry("name", "Aziza");

        List<ConversationRow> conversations = conversationsOf(clientId);
        assertThat(conversations).hasSize(1);
        ConversationRow conversation = conversations.getFirst();
        assertThat(conversation.lastInboundAt()).isEqualTo(sentAt);
        assertThat(conversation.lastMessageAt()).isEqualTo(sentAt);

        List<MessageRow> messages = messagesOf(conversation.id());
        assertThat(messages).containsExactly(new MessageRow(
                conversation.id(),
                "in",
                "client",
                "Здравствуйте!",
                "wamid.store-1",
                sentAt));

        List<Map<String, Object>> events = createdEvents(clientId);
        assertThat(events).hasSize(1);
        assertThat(events.getFirst()).containsEntry("actor", "client");
    }

    @Test
    void existingClientKeepsMasterNameAndAddsNoClientCreatedEvent() {
        UUID clientId = clients.create("+998900000982", "Master Name", "Notes", EventActor.MASTER).id();
        Instant sentAt = Instant.parse("2026-11-01T11:00:00Z");

        Stored stored = inbound.store(List.of(new InboundMessage(
                "wamid.store-2",
                "998900000982",
                "WhatsApp Profile",
                "text",
                "Добрый день",
                sentAt)));

        assertThat(stored).isEqualTo(new Stored(1, 0));
        assertThat(jdbc.queryForObject("select name from clients where id = ?", String.class, clientId))
                .isEqualTo("Master Name");
        List<Map<String, Object>> events = createdEvents(clientId);
        assertThat(events).hasSize(1);
        assertThat(events.getFirst()).containsEntry("actor", "master");
        assertThat(conversationsOf(clientId)).hasSize(1);
    }

    @Test
    void twoMessagesOfOneClientShareConversationAndKeepGreatestInboundTime() {
        Instant t1 = Instant.parse("2026-11-01T12:00:00Z");
        Instant t0 = Instant.parse("2026-11-01T11:30:00Z");

        Stored stored = inbound.store(List.of(
                new InboundMessage("wamid.store-3a", "998900000983", "Aziza", "text", "Первое", t1),
                new InboundMessage("wamid.store-3b", "998900000983", "Aziza", "text", "Раннее", t0)));

        assertThat(stored).isEqualTo(new Stored(2, 0));
        UUID clientId = jdbc.queryForObject(
                "select id from clients where phone = ?",
                UUID.class,
                "+998900000983");
        List<ConversationRow> conversations = conversationsOf(clientId);
        assertThat(conversations).hasSize(1);
        ConversationRow conversation = conversations.getFirst();
        assertThat(conversation.lastInboundAt()).isEqualTo(t1);
        assertThat(conversation.lastMessageAt()).isEqualTo(t1);
        assertThat(messagesOf(conversation.id()))
                .extracting(MessageRow::waMessageId)
                .containsExactlyInAnyOrder("wamid.store-3a", "wamid.store-3b");
    }

    @Test
    void imageMessageIsStoredWithNullBody() {
        Instant sentAt = Instant.parse("2026-11-01T13:00:00Z");

        Stored stored = inbound.store(List.of(new InboundMessage(
                "wamid.store-4",
                "998900000984",
                "Aziza",
                "image",
                null,
                sentAt)));

        assertThat(stored).isEqualTo(new Stored(1, 0));
        MessageRow message = messageByWaId("wamid.store-4");
        assertThat(message.body()).isNull();
        assertThat(message.direction()).isEqualTo("in");
        assertThat(message.author()).isEqualTo("client");
    }

    @Test
    void missingSentAtFallsBackToClockInstant() {
        Stored stored = inbound.store(List.of(new InboundMessage(
                "wamid.store-5",
                "998900000985",
                "Aziza",
                "text",
                "Без времени",
                null)));

        assertThat(stored).isEqualTo(new Stored(1, 0));
        MessageRow message = messageByWaId("wamid.store-5");
        assertThat(message.createdAt()).isEqualTo(FixedClockConfiguration.NOW);
    }

    @Test
    void invalidWaIdsAreSkippedWithoutWritingRows() {
        long clientsBefore = count("clients");
        long conversationsBefore = count("conversations");
        long messagesBefore = count("messages");

        Stored stored = inbound.store(List.of(
                new InboundMessage("wamid.store-bad-1", "12", "Aziza", "text", "short", null),
                new InboundMessage("wamid.store-bad-2", "abc", "Aziza", "text", "letters", null)));

        assertThat(stored).isEqualTo(new Stored(0, 0));
        assertThat(stored.isDuplicate()).isFalse();
        assertThat(count("clients")).isEqualTo(clientsBefore);
        assertThat(count("conversations")).isEqualTo(conversationsBefore);
        assertThat(count("messages")).isEqualTo(messagesBefore);
    }

    @Test
    void repeatingSameMessageReturnsDuplicateWithoutSecondRowOrClientEvent() {
        Instant sentAt = Instant.parse("2026-11-01T14:00:00Z");
        InboundMessage message = new InboundMessage(
                "wamid.store-dup-1",
                "998900000986",
                "Aziza",
                "text",
                "Повтор",
                sentAt);

        Stored first = inbound.store(List.of(message));
        Stored second = inbound.store(List.of(message));

        assertThat(first).isEqualTo(new Stored(1, 0));
        assertThat(first.isDuplicate()).isFalse();
        assertThat(second).isEqualTo(new Stored(0, 1));
        assertThat(second.isDuplicate()).isTrue();

        UUID clientId = jdbc.queryForObject(
                "select id from clients where phone = ?",
                UUID.class,
                "+998900000986");
        ConversationRow conversation = conversationsOf(clientId).getFirst();
        assertThat(messagesOf(conversation.id())).hasSize(1);
        assertThat(createdEvents(clientId)).hasSize(1);
    }

    @Test
    void duplicateMessageWithLaterTimestampDoesNotMoveWindow() {
        Instant initialSentAt = Instant.parse("2026-11-01T14:00:00Z");
        Instant laterSentAt = Instant.parse("2026-11-01T15:30:00Z");

        inbound.store(List.of(new InboundMessage(
                "wamid.store-dup-2",
                "998900000987",
                "Aziza",
                "text",
                "Первое",
                initialSentAt)));

        Stored duplicate = inbound.store(List.of(new InboundMessage(
                "wamid.store-dup-2",
                "998900000987",
                "Aziza",
                "text",
                "Первое снова",
                laterSentAt)));

        assertThat(duplicate).isEqualTo(new Stored(0, 1));
        assertThat(duplicate.isDuplicate()).isTrue();

        UUID clientId = jdbc.queryForObject(
                "select id from clients where phone = ?",
                UUID.class,
                "+998900000987");
        ConversationRow conversation = conversationsOf(clientId).getFirst();
        assertThat(conversation.lastInboundAt()).isEqualTo(initialSentAt);
        assertThat(conversation.lastMessageAt()).isEqualTo(initialSentAt);
    }

    @Test
    void mixedOldAndNewMessagesAndEmptyListAreNotDuplicates() {
        Instant t0 = Instant.parse("2026-11-01T16:00:00Z");
        Instant t1 = Instant.parse("2026-11-01T16:05:00Z");
        InboundMessage oldMessage = new InboundMessage(
                "wamid.store-dup-3a",
                "998900000988",
                "Aziza",
                "text",
                "Старое",
                t0);
        InboundMessage newMessage = new InboundMessage(
                "wamid.store-dup-3b",
                "998900000988",
                "Aziza",
                "text",
                "Новое",
                t1);

        inbound.store(List.of(oldMessage));
        Stored mixed = inbound.store(List.of(oldMessage, newMessage));
        Stored empty = inbound.store(List.of());

        assertThat(mixed).isEqualTo(new Stored(1, 1));
        assertThat(mixed.isDuplicate()).isFalse();
        assertThat(empty).isEqualTo(new Stored(0, 0));
        assertThat(empty.isDuplicate()).isFalse();
    }

    @Test
    void phoneOfNormalizesValidNumbersAndAcceptsE164Fallback() {
        assertThat(InboundMessages.phoneOf("998901234567", "UZ")).contains("+998901234567");
        assertThat(InboundMessages.phoneOf("999123456789", "UZ")).contains("+999123456789");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "12",
            "abc",
            "",
            "+998901234567",
            "998 90 123 45 67",
            "1234567890123456"
    })
    void phoneOfRejectsNonDigitsTooShortOrTooLongWaIds(String waId) {
        assertThat(InboundMessages.phoneOf(waId, "UZ")).isEmpty();
    }

    private List<ConversationRow> conversationsOf(UUID clientId) {
        return jdbc.query(
                "select id, client_id, last_inbound_at, last_message_at from conversations where client_id = ?",
                (rs, rowNum) -> new ConversationRow(
                        rs.getObject("id", UUID.class),
                        rs.getObject("client_id", UUID.class),
                        instant(rs, "last_inbound_at"),
                        instant(rs, "last_message_at")),
                clientId);
    }

    private List<MessageRow> messagesOf(UUID conversationId) {
        return jdbc.query(
                """
                select conversation_id, direction, author, body, wa_message_id, created_at
                from messages
                where conversation_id = ?
                order by created_at, id""",
                (rs, rowNum) -> messageRow(rs),
                conversationId);
    }

    private MessageRow messageByWaId(String waMessageId) {
        return jdbc.queryForObject(
                """
                select conversation_id, direction, author, body, wa_message_id, created_at
                from messages
                where wa_message_id = ?""",
                (rs, rowNum) -> messageRow(rs),
                waMessageId);
    }

    private static MessageRow messageRow(ResultSet rs) throws SQLException {
        return new MessageRow(
                rs.getObject("conversation_id", UUID.class),
                rs.getString("direction"),
                rs.getString("author"),
                rs.getString("body"),
                rs.getString("wa_message_id"),
                instant(rs, "created_at"));
    }

    private List<Map<String, Object>> createdEvents(UUID clientId) {
        entityManager.flush();
        return jdbc.queryForList(
                "select actor, payload::text as payload from events where entity_id = ? and type = 'client_created'",
                clientId);
    }

    private long count(String table) {
        return jdbc.queryForObject("select count(*) from " + table, Long.class);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime odt = rs.getObject(column, OffsetDateTime.class);
        return odt == null ? null : odt.toInstant();
    }
}
