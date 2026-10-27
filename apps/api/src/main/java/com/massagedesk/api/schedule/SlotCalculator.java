package com.massagedesk.api.schedule;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Computes free start times for a service on one day.
 *
 * <p>Pure and deterministic: availability is always computed in code from the schedule,
 * never guessed. Callers load working hours, time off and appointments; this class only does the math.
 */
public final class SlotCalculator {

    /** A block of working time on one day in the master's local time. Several blocks = a break between them. */
    public record WorkingBlock(LocalTime start, LocalTime end) {
        public WorkingBlock {
            Objects.requireNonNull(start);
            Objects.requireNonNull(end);
            if (!start.isBefore(end)) {
                throw new IllegalArgumentException("block start must be before end: " + start + "–" + end);
            }
        }
    }

    /** A busy interval [start, end): a confirmed appointment or time off. */
    public record Interval(Instant start, Instant end) {
        public Interval {
            Objects.requireNonNull(start);
            Objects.requireNonNull(end);
        }

        boolean overlaps(Instant otherStart, Instant otherEnd) {
            return start.isBefore(otherEnd) && otherStart.isBefore(end);
        }
    }

    public record Request(
            LocalDate day,
            ZoneId zone,
            List<WorkingBlock> workingBlocks,
            List<Interval> busy,
            Duration duration,
            Duration step,
            Instant notBefore) {

        public Request {
            Objects.requireNonNull(day);
            Objects.requireNonNull(zone);
            workingBlocks = List.copyOf(workingBlocks);
            busy = List.copyOf(busy);
            if (duration.isZero() || duration.isNegative() || step.isZero() || step.isNegative()) {
                throw new IllegalArgumentException("duration and step must be positive");
            }
        }
    }

    public List<Instant> freeStarts(Request request) {
        List<Instant> slots = new ArrayList<>();
        for (WorkingBlock block : request.workingBlocks()) {
            Instant blockStart = request.day().atTime(block.start()).atZone(request.zone()).toInstant();
            Instant blockEnd = request.day().atTime(block.end()).atZone(request.zone()).toInstant();
            for (Instant start = blockStart;
                    !start.plus(request.duration()).isAfter(blockEnd);
                    start = start.plus(request.step())) {
                Instant end = start.plus(request.duration());
                if (request.notBefore() != null && start.isBefore(request.notBefore())) {
                    continue;
                }
                Instant candidateStart = start;
                if (request.busy().stream().noneMatch(b -> b.overlaps(candidateStart, end))) {
                    slots.add(start);
                }
            }
        }
        slots.sort(Comparator.naturalOrder());
        return List.copyOf(slots);
    }
}
