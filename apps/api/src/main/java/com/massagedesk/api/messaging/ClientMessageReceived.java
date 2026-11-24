package com.massagedesk.api.messaging;

import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One newly stored client message.
 * Published by the webhook after the delivery is committed, outside any transaction,
 * in delivery order, never for duplicates; {@code replyId} is the id of the tapped button or list row.
 */
public record ClientMessageReceived(
        UUID conversationId,
        UUID clientId,
        String waMessageId,
        @Nullable String text,
        @Nullable String replyId) {

    public ClientMessageReceived {
        Objects.requireNonNull(conversationId, "conversationId");
        Objects.requireNonNull(clientId, "clientId");
        Objects.requireNonNull(waMessageId, "waMessageId");
    }
}
