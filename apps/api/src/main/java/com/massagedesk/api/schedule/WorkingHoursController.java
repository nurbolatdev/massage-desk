package com.massagedesk.api.schedule;

import com.massagedesk.api.security.StaffActors;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import com.massagedesk.api.errors.ApiProblem;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The weekly working hours, replaced as a whole. */
@Tag(name = "schedule")
@RestController
@RequestMapping("/working-hours")
class WorkingHoursController {

    private final WorkingHoursService service;

    WorkingHoursController(WorkingHoursService service) {
        this.service = service;
    }

    @Operation(summary = "The weekly working hours")
    @ApiResponse(responseCode = "200", description = "blocks ordered by weekday, then start")
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    WorkingHoursResponse getWorkingHours() {
        return WorkingHoursResponse.from(service.week());
    }

    @Operation(summary = "Replace the whole week of working hours")
    @ApiResponse(responseCode = "200", description = "the stored week")
    @ApiResponse(responseCode = "400", description = "missing or invalid field",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "422", description = "a block ends before it starts, or blocks of one day"
            + " overlap or touch",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "409",
            description = "confirmed appointments are outside the new hours; send force to store anyway",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    WorkingHoursResponse replaceWorkingHours(@Valid @RequestBody WorkingHoursRequest request,
            @Parameter(hidden = true) Authentication authentication) {
        return WorkingHoursResponse.from(service.replaceWeek(
                request.blocks().stream().map(WorkingBlock::toBlock).toList(),
                Boolean.TRUE.equals(request.force()), StaffActors.of(authentication)));
    }
}
