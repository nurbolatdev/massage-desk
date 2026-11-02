package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.UUID;

/** A massage service as the apps see it. */
public record ServiceResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "length in minutes") int durationMin,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal price,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "display order, ascending") int sortOrder,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "inactive services cannot be booked")
        boolean active) {

    static ServiceResponse from(MassageService service) {
        return new ServiceResponse(service.getId(), service.getName(), service.getDurationMin(),
                service.getPrice(), service.getSortOrder(), service.isActive());
    }
}
