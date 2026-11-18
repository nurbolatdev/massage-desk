package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/** One working block of a weekday. The same shape is read and written. */
public record WorkingBlock(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ISO weekday, 1 = Monday … 7 = Sunday")
        @NotNull @Min(1) @Max(7) Integer weekday,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "local time HH:mm in the master's time zone")
        @NotNull @Pattern(regexp = WorkingBlock.TIME) String start,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "local time HH:mm in the master's time zone")
        @NotNull @Pattern(regexp = WorkingBlock.TIME) String end) {

    static final String TIME = "^([01][0-9]|2[0-3]):[0-5][0-9]$";

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    static WorkingBlock from(WorkingHours hours) {
        return new WorkingBlock(hours.getWeekday().getValue(), hours.getStartTime().format(HH_MM),
                hours.getEndTime().format(HH_MM));
    }

    WorkingHoursService.Block toBlock() {
        return new WorkingHoursService.Block(DayOfWeek.of(weekday), LocalTime.parse(start),
                LocalTime.parse(end));
    }
}
