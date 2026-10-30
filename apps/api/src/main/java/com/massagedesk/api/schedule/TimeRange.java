package com.massagedesk.api.schedule;

import java.time.Instant;
import java.util.Objects;

/** A half-open time interval {@code [start, end)}, stored as PostgreSQL {@code tstzrange}. */
public record TimeRange(Instant start, Instant end) {

    public TimeRange {
        Objects.requireNonNull(start, "start");
        Objects.requireNonNull(end, "end");
        if (!start.isBefore(end)) {
            throw new IllegalArgumentException("start must be before end");
        }
    }
}
