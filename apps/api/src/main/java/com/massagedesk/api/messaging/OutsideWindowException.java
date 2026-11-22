package com.massagedesk.api.messaging;

import java.util.Objects;

/**
 * Only template messages may be sent outside the 24-hour window;
 * thrown before anything is sent or stored, or when WhatsApp reports error 131047.
 */
public final class OutsideWindowException extends RuntimeException {

    private static final String MESSAGE =
            "Outside the 24-hour window: only template messages can be sent";

    OutsideWindowException() {
        super(MESSAGE);
    }

    OutsideWindowException(WhatsAppSendException cause) {
        super(MESSAGE, Objects.requireNonNull(cause, "cause"));
    }
}
