package com.massagedesk.api.schedule;

import com.massagedesk.api.errors.ApiProblem;
import com.massagedesk.api.security.StaffActors;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** The master's days off and vacations. */
@Tag(name = "schedule")
@RestController
@RequestMapping("/time-off")
class TimeOffController {

    private static final long MAX_RANGE_DAYS = 366;
    private static final LocalDate MIN_DAY = LocalDate.of(2000, 1, 1);
    private static final LocalDate MAX_DAY = LocalDate.of(2100, 12, 31);

    private final TimeOffService service;

    TimeOffController(TimeOffService service) {
        this.service = service;
    }

    @Operation(summary = "Time off that touches the local days from..to")
    @ApiResponse(responseCode = "200", description = "time off ordered by start")
    @ApiResponse(responseCode = "400", description = "missing or invalid date, or range too long",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    List<TimeOffResponse> listTimeOff(
            @Parameter(description = "first local day, YYYY-MM-DD, inclusive")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @Parameter(description = "last local day, YYYY-MM-DD, inclusive")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        if (from.isBefore(MIN_DAY) || to.isAfter(MAX_DAY)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dates must be within 2000-01-01..2100-12-31");
        }
        if (from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must not be after to");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_RANGE_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "range must be at most 366 days");
        }
        return service.between(from, to).stream().map(TimeOffResponse::from).toList();
    }

    @Operation(summary = "Add time off")
    @ApiResponse(responseCode = "201", description = "time off created")
    @ApiResponse(responseCode = "400", description = "missing or invalid field",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "422", description = "start is not before end, or the period is out of range",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "409",
            description = "confirmed appointments overlap the period; send force to store anyway",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    TimeOffResponse createTimeOff(@Valid @RequestBody CreateTimeOffRequest request,
            @Parameter(hidden = true) Authentication authentication) {
        return TimeOffResponse.from(service.create(
                request.start().toInstant(), request.end().toInstant(), request.reason(),
                Boolean.TRUE.equals(request.force()), StaffActors.of(authentication)));
    }

    @Operation(summary = "Remove time off")
    @ApiResponse(responseCode = "204", description = "time off removed")
    @ApiResponse(responseCode = "400", description = "invalid id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "404", description = "time off not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteTimeOff(@Parameter(description = "time off id") @PathVariable UUID id,
            @Parameter(hidden = true) Authentication authentication) {
        service.delete(id, StaffActors.of(authentication));
    }
}
