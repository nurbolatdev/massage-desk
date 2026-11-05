package com.massagedesk.api.booking;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;

/** An appointment in a list: client and service names, times in the master's UTC offset. */
public record AppointmentListItem(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID clientId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"string", "null"},
                description = "null when the client has no name")
        String clientName,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String clientPhone,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID serviceId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String serviceName,
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

    static AppointmentListItem from(AppointmentService.AppointmentListView view) {
        AppointmentService.AppointmentView a = view.appointment();
        return new AppointmentListItem(
                a.id(),
                a.clientId(),
                view.clientName(),
                view.clientPhone(),
                a.serviceId(),
                view.serviceName(),
                a.period().start().atZone(a.zone()).toOffsetDateTime(),
                a.period().end().atZone(a.zone()).toOffsetDateTime(),
                a.status().name().toLowerCase(Locale.ROOT),
                a.source().name().toLowerCase(Locale.ROOT));
    }
}
