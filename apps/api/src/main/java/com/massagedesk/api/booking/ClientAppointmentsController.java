package com.massagedesk.api.booking;

import com.massagedesk.api.errors.ApiProblem;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Visit history of one client for the master's app and admin. */
@Tag(name = "booking")
@RestController
@RequestMapping("/clients/{clientId}/appointments")
class ClientAppointmentsController {

    private final AppointmentService appointments;

    ClientAppointmentsController(AppointmentService appointments) {
        this.appointments = appointments;
    }

    @Operation(summary = "A client's appointments, newest first")
    @ApiResponse(responseCode = "200", description = "appointments of all statuses, newest first")
    @ApiResponse(responseCode = "400", description = "invalid id or query parameter",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "404", description = "client not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    List<AppointmentListItem> listClientAppointments(
            @Parameter(description = "client id") @PathVariable UUID clientId,
            @Parameter(description = "page size, 1..200") @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit,
            @Parameter(description = "rows to skip") @RequestParam(defaultValue = "0") @Min(0) int offset) {
        return appointments.ofClient(clientId, limit, offset).stream()
                .map(AppointmentListItem::from)
                .toList();
    }
}
