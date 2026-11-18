package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

/** A time off period in the master's UTC offset. */
public record TimeOffResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with the master's UTC offset")
        OffsetDateTime start,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "ISO-8601 with the master's UTC offset, exclusive")
        OffsetDateTime end,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"string", "null"}) String reason) {

    static TimeOffResponse from(TimeOffService.TimeOffView view) {
        return new TimeOffResponse(
                view.id(),
                view.period().start().atZone(view.zone()).toOffsetDateTime(),
                view.period().end().atZone(view.zone()).toOffsetDateTime(),
                view.reason());
    }
}
