package com.massagedesk.api.messaging;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * WhatsApp 24-hour customer service window;
 * exactly 24 hours after the last client message is already closed.
 */
final class WhatsAppWindow {

    static final Duration LENGTH = Duration.ofHours(24);
    private static final int META_OUTSIDE_WINDOW_CODE = 131047;

    private WhatsAppWindow() {
    }

    static boolean isOpen(@Nullable Instant lastInboundAt, Instant now) {
        Objects.requireNonNull(now, "now");
        return lastInboundAt != null && now.isBefore(lastInboundAt.plus(LENGTH));
    }

    static boolean allows(OutboundMessage message, @Nullable Instant lastInboundAt, Instant now) {
        Objects.requireNonNull(message, "message");
        Objects.requireNonNull(now, "now");
        return message instanceof OutboundMessage.Template || isOpen(lastInboundAt, now);
    }

    static boolean closedByMeta(WhatsAppSendException e) {
        Objects.requireNonNull(e, "e");
        return Integer.valueOf(META_OUTSIDE_WINDOW_CODE).equals(e.errorCode());
    }
}
