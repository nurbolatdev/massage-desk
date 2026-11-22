package com.massagedesk.api.messaging;

import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;
import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.ClientService;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.ConversationStore.Recipient;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class OutboundMessagesTests {

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
