package com.massagedesk.api.booking;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Appointment commands for the master's app. Rules live in the service; this maps them to HTTP. */
@Tag(name = "booking")
@RestController
@RequestMapping("/appointments")
class AppointmentsController {

    private final AppointmentService appointments;

    AppointmentsController(AppointmentService appointments) {
        this.appointments = appointments;
    }

    @Operation(summary = "Book a service for a client")
    @ApiResponse(responseCode = "201", description = "appointment created")
    @ApiResponse(responseCode = "400", description = "missing or invalid field",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "client or service not found, or service inactive",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "the time is already booked",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "422",
            description = "outside working hours, in time off or in the past",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    AppointmentResponse createAppointment(@Valid @RequestBody CreateAppointmentRequest request) {
        try {
            return AppointmentResponse.from(appointments.create(
                    request.clientId(), request.serviceId(), request.start().toInstant(),
                    AppointmentSource.MANUAL));
        } catch (BookingException e) {
            throw http(e);
        }
    }

    private static ResponseStatusException http(BookingException e) {
        HttpStatus status = switch (e.reason()) {
            case CLIENT_NOT_FOUND, SERVICE_NOT_FOUND, APPOINTMENT_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case OUTSIDE_SCHEDULE -> HttpStatus.UNPROCESSABLE_CONTENT;
            case TIME_TAKEN, NOT_CONFIRMED, NOT_STARTED ->HttpStatus.CONFLICT;
        };
        return new ResponseStatusException(status, e.getMessage(), e);
    }
}
