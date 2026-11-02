package com.massagedesk.api.booking;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;

/** An appointment with times in the master's UTC offset. */
public record AppointmentResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID clientId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID serviceId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with the master's UTC offset")
        OffsetDateTime start,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with the master's UTC offset")
        OffsetDateTime end,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                allowableValues = {"confirmed", "cancelled", "no_show", "done"})
        String status,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"bot", "manual"})
        String source) {

    static AppointmentResponse from(AppointmentService.AppointmentView view) {
        return new AppointmentResponse(
                view.id(),
                view.clientId(),
                view.serviceId(),
                view.period().start().atZone(view.zone()).toOffsetDateTime(),
                view.period().end().atZone(view.zone()).toOffsetDateTime(),
                view.status().name().toLowerCase(Locale.ROOT),
                view.source().name().toLowerCase(Locale.ROOT));
    }
}
