package com.massagedesk.api.clients;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

/** A client with creation time in the master's UTC offset and visit stats. */
public record ClientListItem(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "E.164, for example +998901234567")
        String phone,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"string", "null"}) String name,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"string", "null"}) String notes,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with the master's UTC offset")
        OffsetDateTime createdAt,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) ClientStatsResponse stats) {

    static ClientListItem from(ClientService.ClientListView view) {
        ClientResponse client = ClientResponse.from(view.client());
        return new ClientListItem(
                client.id(),
                client.phone(),
                client.name(),
                client.notes(),
                client.createdAt(),
                ClientStatsResponse.from(view.stats()));
    }
}
