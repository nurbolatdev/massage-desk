package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** The stored week ordered by weekday, then start. */
public record WorkingHoursResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<WorkingBlock> blocks) {

    static WorkingHoursResponse from(List<WorkingHours> hours) {
        return new WorkingHoursResponse(hours.stream().map(WorkingBlock::from).toList());
    }
}
