package com.massagedesk.api.push;

import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * Unchecked failure thrown when an outbound Expo Push API request cannot be sent
 * or fails at the request level. The exception message contains only the reason,
 * HTTP status, and validated request error code — never tokens, notification text,
 * or raw error messages.
 */
final class PushSendException extends RuntimeException {

    enum Reason {
        NOT_CONFIGURED,
        UNAUTHORIZED,
        RATE_LIMITED,
        UNAVAILABLE,
        REJECTED,
        INVALID_RESPONSE
    }

    private final Reason reason;
    private final int httpStatus;
    private final @Nullable String errorCode;

    PushSendException(Reason reason, int httpStatus, @Nullable String errorCode) {
        this(reason, httpStatus, errorCode, null);
    }

    PushSendException(
            Reason reason,
            int httpStatus,
            @Nullable String errorCode,
            @Nullable Throwable cause) {
        super(formatMessage(reason, httpStatus, errorCode), cause);
        this.reason = reason;
        this.httpStatus = httpStatus;
        this.errorCode = errorCode;
    }

    Reason reason() {
        return reason;
    }

    int httpStatus() {
        return httpStatus;
    }

    @Nullable String errorCode() {
        return errorCode;
    }

    private static String formatMessage(Reason reason, int httpStatus, @Nullable String errorCode) {
        Objects.requireNonNull(reason, "reason");
        return "push request failed: "
                + reason
                + (httpStatus > 0 ? " (HTTP " + httpStatus + ")" : "")
                + (errorCode != null ? " " + errorCode : "");
    }
}
