package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Documentation of the {@code 409} problem body of time off and working hours. It is only the
 * OpenAPI schema and is never instantiated; a test keeps its members equal to the real response.
 */
public record ScheduleConflictProblem(
        String type,
        String title,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int status,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String detail,
        String instance,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "machine-readable reason, always APPOINTMENT_CONFLICT here")
        String code,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "the confirmed appointments in the way, ordered by start")
        List<AppointmentConflict> conflicts) {
}
