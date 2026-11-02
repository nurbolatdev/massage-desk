package com.massagedesk.api.booking;

import java.util.Objects;

/** A booking command was refused. The reason tells the caller which rule applied. */
public class BookingException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** Why a booking command was refused. */
    public enum Reason {
        CLIENT_NOT_FOUND,
        SERVICE_NOT_FOUND,
        APPOINTMENT_NOT_FOUND,
        OUTSIDE_SCHEDULE,
        TIME_TAKEN
    }

    private final Reason reason;

    public BookingException(Reason reason, String message) {
        super(message);
        this.reason = Objects.requireNonNull(reason, "reason");
    }

    public BookingException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = Objects.requireNonNull(reason, "reason");
    }

    public Reason reason() {
        return reason;
    }
}
