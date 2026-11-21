package com.massagedesk.api.messaging;

import java.time.Instant;
import java.time.ZoneOffset;
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
}
