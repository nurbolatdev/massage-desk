package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;

/** A new time off period {@code [start, end)}. */
public record CreateTimeOffRequest(
        @NotNull @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with offset; a day off starts at local midnight")
        OffsetDateTime start,
        @NotNull @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with offset, exclusive")
        OffsetDateTime end,
        @Size(max = 200) String reason) {
}
