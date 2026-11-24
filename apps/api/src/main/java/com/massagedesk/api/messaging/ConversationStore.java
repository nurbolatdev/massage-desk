package com.massagedesk.api.messaging;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Conversations and messages written in plain SQL so parallel deliveries meet at the unique keys.
 */
@Repository
class ConversationStore {

    private final JdbcClient jdbc;

    ConversationStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    UUID conversationOf(UUID clientId) {
        jdbc.sql("""
                insert into conversations (client_id)
                values (:clientId)
                on conflict (client_id) do nothing""")
                .param("clientId", clientId)
                .update();
        return jdbc.sql("select id from conversations where client_id = :clientId")
                .param("clientId", clientId)
                .query(UUID.class)
                .single();
    }

    boolean addInbound(UUID conversationId, String waMessageId, @Nullable String body, Instant at) {
        return jdbc.sql("""
                insert into messages (conversation_id, direction, author, body, wa_message_id, created_at)
                values (:conversationId, 'in', 'client', cast(:body as text), :waMessageId, cast(:at as timestamptz))
                on conflict (wa_message_id) do nothing""")
                .param("conversationId", conversationId)
                .param("body", body)
                .param("waMessageId", waMessageId)
                .param("at", at.atOffset(ZoneOffset.UTC))
                .update() == 1;
    }

    void touchInbound(UUID conversationId, Instant at) {
        jdbc.sql("""
                update conversations
                set last_inbound_at = greatest(last_inbound_at, cast(:at as timestamptz)),
                    last_message_at = greatest(last_message_at, cast(:at as timestamptz))
                where id = :id""")
                .param("at", at.atOffset(ZoneOffset.UTC))
                .param("id", conversationId)
                .update();
    }

    record Recipient(String phone, @Nullable Instant lastInboundAt) {

        @Override
        public String toString() {
            return "Recipient[phone=<hidden>, lastInboundAt=" + lastInboundAt + "]";
        }
    }

    Optional<Recipient> recipientOf(UUID conversationId) {
        return jdbc.sql("""
                select c.phone, v.last_inbound_at
                from conversations v
                join clients c on c.id = v.client_id
                where v.id = :id""")
                .param("id", conversationId)
                .query((rs, rowNum) -> {
                    OffsetDateTime odt = rs.getObject("last_inbound_at", OffsetDateTime.class);
                    return new Recipient(rs.getString("phone"), odt == null ? null : odt.toInstant());
                })
                .optional();
    }

    Optional<UUID> addOutbound(
            UUID conversationId,
            String author,
            @Nullable String body,
            String waMessageId,
            Instant at) {
        return jdbc.sql("""
                with added as (
                    insert into messages (conversation_id, direction, author, body, wa_message_id, created_at)
                    values (:conversationId, 'out', :author, cast(:body as text), :waMessageId, cast(:at as timestamptz))
                    on conflict (wa_message_id) do nothing
                    returning id
                ), touched as (
                    update conversations
                    set last_message_at = greatest(last_message_at, cast(:at as timestamptz))
                    where id = :conversationId and exists (select 1 from added)
                )
                select id from added""")
                .param("conversationId", conversationId)
                .param("author", author)
                .param("body", body)
                .param("waMessageId", waMessageId)
                .param("at", at.atOffset(ZoneOffset.UTC))
                .query(UUID.class)
                .optional();
    }

    Optional<UUID> messageIdOf(UUID conversationId, String waMessageId) {
        return jdbc.sql("""
                select id from messages
                where wa_message_id = :waMessageId
                  and conversation_id = :conversationId
                  and direction = 'out'""")
                .param("waMessageId", waMessageId)
                .param("conversationId", conversationId)
                .query(UUID.class)
                .optional();
    }
}
