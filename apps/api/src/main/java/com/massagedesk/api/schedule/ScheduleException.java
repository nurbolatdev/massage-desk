package com.massagedesk.api.schedule;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** A schedule command was refused. The reason tells the caller which rule applied. */
public class ScheduleException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** Why a schedule command was refused. */
    public enum Reason {
        SERVICE_NOT_FOUND,
        TIME_OFF_NOT_FOUND,
        INVALID_HOURS,
        INVALID_TIME_OFF,
        APPOINTMENT_CONFLICT
    }

    /** A confirmed appointment in the way of a change, with times in the master's offset. */
    public record Conflict(UUID appointmentId, String clientName, OffsetDateTime start, OffsetDateTime end) {
    }

    private final Reason reason;
    private final transient List<Conflict> conflicts;

    public ScheduleException(Reason reason, String message) {
        this(reason, message, List.of());
    }

    public ScheduleException(Reason reason, String message, List<Conflict> conflicts) {
        super(message);
        this.reason = Objects.requireNonNull(reason, "reason");
        this.conflicts = List.copyOf(conflicts);
    }

    public Reason reason() {
        return reason;
    }

    /** The appointments in the way, ordered by start; empty unless the reason is a conflict. */
    public List<Conflict> conflicts() {
        return conflicts;
    }
}
