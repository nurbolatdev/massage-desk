package com.massagedesk.api.bot;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

record BotSession(
        Step step,
        @Nullable UUID serviceId,
        @Nullable LocalDate day,
        @Nullable Instant start,
        @Nullable UUID appointmentId) {

    BotSession {
        Objects.requireNonNull(step, "step");
    }

    static BotSession menu() {
        return new BotSession(Step.MENU, null, null, null, null);
    }

    enum Step {
        MENU("menu"),
        SERVICE("service"),
        DAY("day"),
        TIME("time"),
        CONFIRM("confirm"),
        MOVE_PICK("move_pick"),
        CANCEL_PICK("cancel_pick"),
        CANCEL_CONFIRM("cancel_confirm");

        private final String column;

        Step(String column) {
            this.column = column;
        }

        String column() {
            return column;
        }

        static Optional<Step> of(@Nullable String column) {
            if (column == null) {
                return Optional.empty();
            }
            for (Step step : values()) {
                if (step.column.equals(column)) {
                    return Optional.of(step);
                }
            }
            return Optional.empty();
        }
    }
}
