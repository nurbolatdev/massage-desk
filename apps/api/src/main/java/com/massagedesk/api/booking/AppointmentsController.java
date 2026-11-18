package com.massagedesk.api.booking;

import com.massagedesk.api.booking.AppointmentService.RequestKey;
import com.massagedesk.api.errors.ApiProblem;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Parameter;
import com.massagedesk.api.security.StaffActors;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Appointment commands for the master's app. Rules live in the service; this maps them to HTTP. */
@Tag(name = "booking")
@RestController
@RequestMapping("/appointments")
class AppointmentsController {

    private static final long MAX_RANGE_DAYS = 62;
    private static final LocalDate MIN_DAY = LocalDate.of(2000, 1, 1);
    private static final LocalDate MAX_DAY = LocalDate.of(2100, 12, 31);

    private final AppointmentService appointments;

    AppointmentsController(AppointmentService appointments) {
        this.appointments = appointments;
    }

    @Operation(summary = "Appointments that touch the local days from..to")
    @ApiResponse(responseCode = "200", description = "appointments of all statuses ordered by start")
    @ApiResponse(responseCode = "400", description = "missing or invalid date, or range too long",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    List<AppointmentListItem> listAppointments(
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "range must be at most 62 days");
        }
        return appointments.between(from, to).stream().map(AppointmentListItem::from).toList();
    }

    @Operation(summary = "One appointment with client and service names")
    @ApiResponse(responseCode = "200", description = "the appointment, any status, in the same shape as a list item")
    @ApiResponse(responseCode = "400", description = "invalid id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "404", description = "appointment not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    AppointmentListItem getAppointment(@Parameter(description = "appointment id") @PathVariable UUID id) {
        return AppointmentListItem.from(appointments.byId(id));
    }

    @Operation(summary = "Book a service for a client")
    @ApiResponse(responseCode = "201",
            description = "appointment created; a repeat with the same Idempotency-Key returns the appointment as it was created")
    @ApiResponse(responseCode = "400", description = "missing or invalid field",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "404", description = "client or service not found, or service inactive",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "409", description = "the time is already booked",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "422",
            description = "outside working hours, in time off or in the past, or the Idempotency-Key was already used with another request",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    AppointmentResponse createAppointment(
            @Valid @RequestBody CreateAppointmentRequest request,
            @Parameter(name = "Idempotency-Key",
                    description = "optional UUID created by the client once per booking form; a repeat with the same key and body within 24 hours returns the first result instead of booking again")
            @RequestHeader(name = "Idempotency-Key", required = false) UUID idempotencyKey,
            @Parameter(hidden = true) Authentication authentication) {
        RequestKey key = idempotencyKey == null
                ? null
                : new RequestKey(StaffActors.userId(authentication), idempotencyKey);
        return AppointmentResponse.from(appointments.create(
                request.clientId(), request.serviceId(), request.start().toInstant(),
                AppointmentSource.MANUAL, StaffActors.of(authentication), key));
    }

    @Operation(summary = "Move an appointment to another start, keeping its length")
    @ApiResponse(responseCode = "200", description = "appointment moved")
    @ApiResponse(responseCode = "400", description = "missing or invalid field or id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "404", description = "appointment not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "409", description = "the time is already booked, or the appointment is not confirmed",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "422", description = "outside working hours, in time off or in the past",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @PostMapping(value = "/{id}/reschedule", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    AppointmentResponse rescheduleAppointment(
            @Parameter(description = "appointment id") @PathVariable UUID id,
            @Valid @RequestBody RescheduleAppointmentRequest request,
            @Parameter(hidden = true) Authentication authentication) {
        return AppointmentResponse.from(appointments.reschedule(id, request.start().toInstant(), StaffActors.of(authentication)));
    }

    @Operation(summary = "Cancel an appointment")
    @ApiResponse(responseCode = "200", description = "appointment cancelled")
    @ApiResponse(responseCode = "400", description = "invalid id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "404", description = "appointment not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "409", description = "the appointment is not confirmed",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @PostMapping(value = "/{id}/cancel", produces = MediaType.APPLICATION_JSON_VALUE)
    AppointmentResponse cancelAppointment(
            @Parameter(description = "appointment id") @PathVariable UUID id,
            @Parameter(hidden = true) Authentication authentication) {
        return AppointmentResponse.from(appointments.cancel(id, StaffActors.of(authentication)));
    }

    @Operation(summary = "Mark that the client did not come")
    @ApiResponse(responseCode = "200", description = "appointment marked as no-show")
    @ApiResponse(responseCode = "400", description = "invalid id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "404", description = "appointment not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "409", description = "the appointment is not confirmed or has not started yet",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @PostMapping(value = "/{id}/no-show", produces = MediaType.APPLICATION_JSON_VALUE)
    AppointmentResponse markNoShow(
            @Parameter(description = "appointment id") @PathVariable UUID id,
            @Parameter(hidden = true) Authentication authentication) {
        return AppointmentResponse.from(appointments.markNoShow(id, StaffActors.of(authentication)));
    }
}
