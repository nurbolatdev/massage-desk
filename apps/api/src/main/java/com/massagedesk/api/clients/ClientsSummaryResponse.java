package com.massagedesk.api.clients;

import io.swagger.v3.oas.annotations.media.Schema;

/** Total number of clients and how many were added in the last 30 days. */
public record ClientsSummaryResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "all clients") long total,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "clients added in the last 30 days")
        long newLast30Days) {

    static ClientsSummaryResponse from(ClientService.ClientsSummaryView view) {
        return new ClientsSummaryResponse(view.total(), view.newLast30Days());
    }
}
