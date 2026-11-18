package com.massagedesk.api.clients;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/** Partial update of a client. A missing field stays as is; a blank text clears the field. */
public record UpdateClientRequest(
        @Schema(description = "blank clears the name") @Size(max = 100) String name,
        @Schema(description = "blank clears the notes") @Size(max = 2000) String notes) {
}
