package com.massagedesk.api.errors;

import com.massagedesk.api.schedule.AppointmentConflict;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * The body of every documented error response. It is only the OpenAPI schema and is never
 * instantiated: the error handler writes a problem detail with the same members. The tests
 * {@code ProblemResponsesTests} and {@code ErrorSchemaDocumentTests} keep it equal to real bodies.
 */
public record ApiProblem(
        @Schema(description = "absent while it is about:blank")
        String type,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        String title,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        int status,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "human-readable; do not branch on it")
        String detail,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "the request path")
        String instance,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "branch on this")
        ErrorCode code,
        @Schema(description = "only with APPOINTMENT_CONFLICT: the confirmed appointments in the way, "
                + "ordered by start")
        List<AppointmentConflict> conflicts) {
}
