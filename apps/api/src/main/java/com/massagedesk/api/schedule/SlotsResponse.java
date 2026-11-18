package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** Free start times of one day, expressed in the master's time zone. */
public record SlotsResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDate day,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "IANA time zone of the master")
        String timeZone,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "service length in minutes")
        int durationMin,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "free start times, ISO-8601 with the master's UTC offset")
        List<OffsetDateTime> starts) {

    static SlotsResponse from(SlotService.DaySlots slots) {
        return new SlotsResponse(
                slots.day(),
                slots.zone().getId(),
                (int) slots.duration().toMinutes(),
                slots.starts().stream().map(s -> s.atZone(slots.zone()).toOffsetDateTime()).toList());
    }
}
