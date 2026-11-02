package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

/** A confirmed appointment that a schedule change would leave uncovered. Times use the master's offset. */
public record AppointmentConflict(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID appointmentId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"string", "null"},
                description = "the client's name, null when the client has none")
        String clientName,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with the master's UTC offset")
        OffsetDateTime start,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with the master's UTC offset")
        OffsetDateTime end) {

    public static AppointmentConflict from(ScheduleException.Conflict c) {
        return new AppointmentConflict(c.appointmentId(), c.clientName(), c.start(), c.end());
    }
}
