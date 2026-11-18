package com.massagedesk.api.clients;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

/** A client with the creation time in the master's UTC offset. */
public record ClientResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "E.164, for example +998901234567")
        String phone,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"string", "null"}) String name,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"string", "null"}) String notes,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with the master's UTC offset")
        OffsetDateTime createdAt) {

    static ClientResponse from(ClientService.ClientView view) {
        return new ClientResponse(
                view.id(),
                view.phone(),
                view.name(),
                view.notes(),
                view.createdAt().atZone(view.zone()).toOffsetDateTime());
    }
}
