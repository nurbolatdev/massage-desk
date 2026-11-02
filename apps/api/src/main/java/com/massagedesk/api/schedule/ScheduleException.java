package com.massagedesk.api.schedule;

import java.util.Objects;

/** A schedule command was refused. The reason tells the caller which rule applied. */
public class ScheduleException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** Why a schedule command was refused. */
    public enum Reason {
        SERVICE_NOT_FOUND
    }

    private final Reason reason;

    public ScheduleException(Reason reason, String message) {
        super(message);
        this.reason = Objects.requireNonNull(reason, "reason");
    }

    public Reason reason() {
        return reason;
    }
}
