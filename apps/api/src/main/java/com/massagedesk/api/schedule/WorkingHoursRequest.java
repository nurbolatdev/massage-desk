package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** The whole week. A weekday without blocks is a day off. */
public record WorkingHoursRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "every block of the week, at most 50")
        @NotNull @Size(max = 50) List<@NotNull @Valid WorkingBlock> blocks,
        @Schema(requiredMode = Schema.RequiredMode.NOT_REQUIRED,
                description = "store even if confirmed appointments conflict; the appointments are kept")
        Boolean force) {
}
