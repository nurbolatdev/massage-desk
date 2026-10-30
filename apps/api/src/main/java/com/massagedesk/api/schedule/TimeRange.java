package com.massagedesk.api.schedule;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

/** A half-open time interval {@code [start, end)}, stored as PostgreSQL {@code tstzrange}. */
public record TimeRange(Instant start, Instant end) {

    public TimeRange {
        Objects.requireNonNull(start, "start");
        Objects.requireNonNull(end, "end");
        start = start.truncatedTo(ChronoUnit.MICROS);
        end = end.truncatedTo(ChronoUnit.MICROS);
        if (!start.isBefore(end)) {
            throw new IllegalArgumentException("start must be before end");
        }
    }
}
