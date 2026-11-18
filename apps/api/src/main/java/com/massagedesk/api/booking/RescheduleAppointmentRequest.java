package com.massagedesk.api.booking;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;

/** Request to move an appointment. The booked length is kept. */
public record RescheduleAppointmentRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with offset; the booked length is kept")
        @NotNull OffsetDateTime start) {
}
