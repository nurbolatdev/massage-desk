package com.massagedesk.api.messaging;

import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * Unchecked failure thrown when an outbound WhatsApp Cloud API request cannot be sent
 * or is rejected by Meta. The exception message never includes credentials, phone numbers,
 * message text, or raw error messages from Meta.
 */
public final class WhatsAppSendException extends RuntimeException {

    public enum Reason {
        NOT_CONFIGURED,
        UNAUTHORIZED,
        RATE_LIMITED,
        UNAVAILABLE,
        REJECTED,
        INVALID_RESPONSE
    }

    private final Reason reason;
    private final int httpStatus;
    private final @Nullable Integer errorCode;

    WhatsAppSendException(Reason reason, int httpStatus, @Nullable Integer errorCode) {
        this(reason, httpStatus, errorCode, null);
    }

    WhatsAppSendException(
            Reason reason,
            int httpStatus,
            @Nullable Integer errorCode,
            @Nullable Throwable cause) {
        super(formatMessage(reason, httpStatus, errorCode), cause);
        this.reason = reason;
        this.httpStatus = httpStatus;
        this.errorCode = errorCode;
    }

    public Reason reason() {
        return reason;
    }

    public int httpStatus() {
        return httpStatus;
    }

    public @Nullable Integer errorCode() {
        return errorCode;
    }

    public boolean retryable() {
        return reason == Reason.RATE_LIMITED || reason == Reason.UNAVAILABLE;
    }

    private static String formatMessage(Reason reason, int httpStatus, @Nullable Integer errorCode) {
        Objects.requireNonNull(reason, "reason");
        String code = errorCode != null ? errorCode.toString() : "none";
        return "WhatsApp send failed: " + reason + " (HTTP " + httpStatus + ", code " + code + ")";
    }
}
