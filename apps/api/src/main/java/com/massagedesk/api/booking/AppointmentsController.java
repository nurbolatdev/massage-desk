package com.massagedesk.api.booking;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Parameter;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.security.StaffRole;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
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
    AppointmentResponse createAppointment(@Valid @RequestBody CreateAppointmentRequest request,
            @Parameter(hidden = true) Authentication authentication) {
        try {
            return AppointmentResponse.from(appointments.create(
                    request.clientId(), request.serviceId(), request.start().toInstant(),
                    AppointmentSource.MANUAL, actor(authentication)));
        } catch (BookingException e) {
            throw http(e);
        }
    }

    @Operation(summary = "Move an appointment to another start, keeping its length")
    @ApiResponse(responseCode = "200", description = "appointment moved")
    @ApiResponse(responseCode = "400", description = "missing or invalid field or id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "appointment not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "the time is already booked, or the appointment is not confirmed",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "422", description = "outside working hours, in time off or in the past",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(value = "/{id}/reschedule", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    AppointmentResponse rescheduleAppointment(
            @Parameter(description = "appointment id") @PathVariable UUID id,
            @Valid @RequestBody RescheduleAppointmentRequest request,
            @Parameter(hidden = true) Authentication authentication) {
        try {
            return AppointmentResponse.from(appointments.reschedule(id, request.start().toInstant(), actor(authentication)));
        } catch (BookingException e) {
            throw http(e);
        }
    }

    @Operation(summary = "Cancel an appointment")
    @ApiResponse(responseCode = "200", description = "appointment cancelled")
    @ApiResponse(responseCode = "400", description = "invalid id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "appointment not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "the appointment is not confirmed",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(value = "/{id}/cancel", produces = MediaType.APPLICATION_JSON_VALUE)
    AppointmentResponse cancelAppointment(
            @Parameter(description = "appointment id") @PathVariable UUID id,
            @Parameter(hidden = true) Authentication authentication) {
        try {
            return AppointmentResponse.from(appointments.cancel(id, actor(authentication)));
        } catch (BookingException e) {
            throw http(e);
        }
    }

    @Operation(summary = "Mark that the client did not come")
    @ApiResponse(responseCode = "200", description = "appointment marked as no-show")
    @ApiResponse(responseCode = "400", description = "invalid id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "appointment not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "the appointment is not confirmed or has not started yet",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(value = "/{id}/no-show", produces = MediaType.APPLICATION_JSON_VALUE)
    AppointmentResponse markNoShow(
            @Parameter(description = "appointment id") @PathVariable UUID id,
            @Parameter(hidden = true) Authentication authentication) {
        try {
            return AppointmentResponse.from(appointments.markNoShow(id, actor(authentication)));
        } catch (BookingException e) {
            throw http(e);
        }
    }

    private static EventActor actor(Authentication authentication) {
        boolean admin = authentication.getAuthorities().stream()
                .anyMatch(a -> StaffRole.ADMIN.authority().equals(a.getAuthority()));
        return admin ? EventActor.ADMIN : EventActor.MASTER;
    }

    private static ResponseStatusException http(BookingException e) {
        HttpStatus status = switch (e.reason()) {
            case CLIENT_NOT_FOUND, SERVICE_NOT_FOUND, APPOINTMENT_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case OUTSIDE_SCHEDULE -> HttpStatus.UNPROCESSABLE_CONTENT;
            case TIME_TAKEN, NOT_CONFIRMED, NOT_STARTED -> HttpStatus.CONFLICT;
        };
        return new ResponseStatusException(status, e.getMessage(), e);
    }
}
