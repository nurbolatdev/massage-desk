package com.massagedesk.api.clients;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Visit summary of one client, with timestamps in the master's UTC offset. */
public record ClientStatsResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "done appointments and confirmed ones that have ended")
        int visits,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "sum of current service prices over the visits")
        BigDecimal totalSpent,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int noShows,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"string", "null"},
                description = "ISO-8601 with the master's UTC offset; null when none")
        OffsetDateTime lastVisitAt,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"string", "null"},
                description = "ISO-8601 with the master's UTC offset; null when none")
        OffsetDateTime nextAppointmentAt,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"integer", "null"},
                description = "average days between visits; null with fewer than two visits")
        Integer visitIntervalDays) {

    static ClientStatsResponse from(ClientService.ClientStatsView view) {
        return new ClientStatsResponse(
                view.visits(),
                view.totalSpent(),
                view.noShows(),
                view.lastVisitAt() == null ? null : view.lastVisitAt().atZone(view.zone()).toOffsetDateTime(),
                view.nextAppointmentAt() == null
                        ? null
                        : view.nextAppointmentAt().atZone(view.zone()).toOffsetDateTime(),
                view.visitIntervalDays());
    }
}
