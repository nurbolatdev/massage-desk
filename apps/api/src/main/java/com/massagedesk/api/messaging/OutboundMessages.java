package com.massagedesk.api.messaging;

import com.massagedesk.api.messaging.ConversationStore.Recipient;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

/**
 * Sends one message to the client of a conversation; only templates outside the 24-hour window
 * ({@link OutsideWindowException} before any request or write, also for WhatsApp error 131047);
 * stores the message only after WhatsApp accepted it, idempotent by WhatsApp message id;
 * opens no database transaction and must not be called inside one, so the HTTP request never holds a connection.
 */
@Service
public class OutboundMessages {

    public enum Author {
        BOT,
        MASTER
    }

    public record Sent(UUID messageId, String waMessageId) {
    }

    private final ConversationStore conversations;
    private final WhatsAppClient client;
    private final Clock clock;

    OutboundMessages(ConversationStore conversations, WhatsAppClient client, Clock clock) {
        this.conversations = Objects.requireNonNull(conversations, "conversations");
        this.client = Objects.requireNonNull(client, "client");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public Sent send(UUID conversationId, Author author, OutboundMessage message) {
        Objects.requireNonNull(conversationId, "conversationId");
        Objects.requireNonNull(author, "author");
        Objects.requireNonNull(message, "message");

        Recipient recipient = conversations.recipientOf(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("unknown conversation"));

        Instant now = clock.instant();
        if (!WhatsAppWindow.allows(message, recipient.lastInboundAt(), now)) {
            throw new OutsideWindowException();
        }

        String waMessageId;
        try {
            waMessageId = client.send(recipient.phone(), message);
        } catch (WhatsAppSendException e) {
            if (WhatsAppWindow.closedByMeta(e)) {
                throw new OutsideWindowException(e);
            }
            throw e;
        }

        Instant at = clock.instant();
        UUID messageId = conversations.addOutbound(
                        conversationId,
                        column(author),
                        bodyOf(message),
                        waMessageId,
                        at)
                .orElseGet(() -> conversations.messageIdOf(waMessageId));

        return new Sent(messageId, waMessageId);
    }

    private static @Nullable String bodyOf(OutboundMessage m) {
        return switch (m) {
            case OutboundMessage.Text t -> t.body();
            case OutboundMessage.Buttons b -> b.body();
            case OutboundMessage.ListMenu l -> l.body();
            case OutboundMessage.Template ignored -> null;
        };
    }

    private static String column(Author a) {
        return switch (a) {
            case BOT -> "bot";
            case MASTER -> "master";
        };
    }
}
