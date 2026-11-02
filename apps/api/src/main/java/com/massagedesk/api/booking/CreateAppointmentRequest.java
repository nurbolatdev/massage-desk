package com.massagedesk.api.booking;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Request to book a service for a client. The end comes from the service length. */
public record CreateAppointmentRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "id of an existing client")
        @NotNull UUID clientId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "id of an active service")
        @NotNull UUID serviceId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with offset; the end is start plus the service length")
        @NotNull OffsetDateTime start) {
}
