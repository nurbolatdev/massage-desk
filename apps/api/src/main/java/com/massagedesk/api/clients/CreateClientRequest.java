package com.massagedesk.api.clients;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request to add a client. */
public record CreateClientRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "any format; stored as E.164")
        @NotBlank @Size(max = 32) String phone,
        @Size(max = 100) String name,
        @Size(max = 2000) String notes) {
}
