package com.massagedesk.api.messaging;

import com.massagedesk.api.clients.ClientService;
import com.massagedesk.api.events.EventActor;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.JdbcTemplate;

final class OutboundRows {

    private OutboundRows() {
    }

    record ConversationRow(UUID id, UUID clientId, Instant lastInboundAt, Instant lastMessageAt) {
    }

    record MessageRow(
            UUID id,
            UUID conversationId,
            String direction,
            String author,
            String body,
            String waMessageId,
            Instant createdAt) {
    }

    static UUID conversation(
            ClientService clients,
            ConversationStore store,
            JdbcTemplate jdbc,
            String phone,
            @Nullable Instant lastInboundAt) {
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

    static ConversationRow conversationRow(JdbcTemplate jdbc, UUID conversationId) {
        return jdbc.queryForObject(
                "select id, client_id, last_inbound_at, last_message_at from conversations where id = ?",
                (rs, rowNum) -> new ConversationRow(
                        rs.getObject("id", UUID.class),
                        rs.getObject("client_id", UUID.class),
                        instant(rs, "last_inbound_at"),
                        instant(rs, "last_message_at")),
                conversationId);
    }

    static List<MessageRow> messagesOf(JdbcTemplate jdbc, UUID conversationId) {
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

    static long count(JdbcTemplate jdbc, String table) {
        return jdbc.queryForObject("select count(*) from " + table, Long.class);
    }

    static void deleteByPhoneLike(JdbcTemplate jdbc, String phonePattern) {
        jdbc.update("""
                delete from messages
                where conversation_id in (
                    select id from conversations
                    where client_id in (select id from clients where phone like ?)
                )""", phonePattern);
        jdbc.update("""
                delete from conversations
                where client_id in (select id from clients where phone like ?)""", phonePattern);
        jdbc.update("""
                delete from events
                where type = 'client_created'
                  and entity_id in (select id from clients where phone like ?)""", phonePattern);
        jdbc.update("delete from clients where phone like ?", phonePattern);
    }

    static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime odt = rs.getObject(column, OffsetDateTime.class);
        return odt == null ? null : odt.toInstant();
    }
}
