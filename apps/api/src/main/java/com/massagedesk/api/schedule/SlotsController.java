package com.massagedesk.api.schedule;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Free start times for the master's app; times are computed by code. */
@Tag(name = "schedule")
@RestController
@RequestMapping("/slots")
class SlotsController {

    private final SlotService slotService;

    SlotsController(SlotService slotService) {
        this.slotService = slotService;
    }

    @Operation(summary = "Free start times for a service on a day")
    @ApiResponse(responseCode = "200", description = "free start times, possibly empty")
    @ApiResponse(responseCode = "400", description = "invalid or missing serviceId or day",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "service not found or inactive",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    SlotsResponse slots(
            @Parameter(description = "id of an active service")
            @RequestParam(name = "serviceId") UUID serviceId,
            @Parameter(description = "local date in the master's time zone, YYYY-MM-DD")
            @RequestParam(name = "day") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate day) {
        return slotService.freeStarts(serviceId, day)
                .map(SlotsResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "service not found"));
    }
}
