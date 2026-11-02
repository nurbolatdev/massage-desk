package com.massagedesk.api.errors;

import com.massagedesk.api.booking.BookingException;
import com.massagedesk.api.clients.ClientException;
import com.massagedesk.api.schedule.AppointmentConflict;
import com.massagedesk.api.schedule.ScheduleException;
import com.massagedesk.api.settings.SettingsException;
import io.swagger.v3.oas.annotations.Hidden;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * The one place that maps errors to problem details. A domain error gets the status of its
 * rule, the message as {@code detail} and a machine-readable {@code code}. Client errors raised
 * by the web framework keep the framework's status and text and get the code
 * {@link ErrorCode#INVALID_REQUEST}. Extending the framework's handler (instead of leaving it to
 * the default one) is what lets {@link #createResponseEntity} add that code.
 */
@Hidden
@RestControllerAdvice
class DomainErrorHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(BookingException.class)
    ResponseEntity<ProblemDetail> booking(BookingException e) {
        HttpStatus status = switch (e.reason()) {
            case CLIENT_NOT_FOUND, SERVICE_NOT_FOUND, APPOINTMENT_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case OUTSIDE_SCHEDULE -> HttpStatus.UNPROCESSABLE_CONTENT;
            case TIME_TAKEN, NOT_CONFIRMED, NOT_STARTED -> HttpStatus.CONFLICT;
        };
        return problem(status, e.getMessage(), code(e.reason()));
    }

    @ExceptionHandler(ClientException.class)
    ResponseEntity<ProblemDetail> client(ClientException e) {
        HttpStatus status = switch (e.reason()) {
            case CLIENT_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case INVALID_PHONE -> HttpStatus.BAD_REQUEST;
            case PHONE_TAKEN -> HttpStatus.CONFLICT;
        };
        return problem(status, e.getMessage(), code(e.reason()));
    }

    @ExceptionHandler(ScheduleException.class)
    ResponseEntity<ProblemDetail> schedule(ScheduleException e) {
        HttpStatus status = switch (e.reason()) {
            case SERVICE_NOT_FOUND, TIME_OFF_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case INVALID_HOURS, INVALID_TIME_OFF -> HttpStatus.UNPROCESSABLE_CONTENT;
            case APPOINTMENT_CONFLICT -> HttpStatus.CONFLICT;
        };
        ResponseEntity<ProblemDetail> response = problem(status, e.getMessage(), code(e.reason()));
        if (e.reason() == ScheduleException.Reason.APPOINTMENT_CONFLICT) {
            response.getBody().setProperty("conflicts",
                    e.conflicts().stream().map(AppointmentConflict::from).toList());
        }
        return response;
    }

    @ExceptionHandler(SettingsException.class)
    ResponseEntity<ProblemDetail> settings(SettingsException e) {
        HttpStatus status = switch (e.reason()) {
            case UNKNOWN_TIME_ZONE -> HttpStatus.BAD_REQUEST;
        };
        return problem(status, e.getMessage(), code(e.reason()));
    }

    @Override
    protected ResponseEntity<Object> createResponseEntity(@Nullable Object body, HttpHeaders headers,
            HttpStatusCode statusCode, WebRequest request) {
        if (body instanceof ProblemDetail problem && statusCode.is4xxClientError()
                && (problem.getProperties() == null || !problem.getProperties().containsKey("code"))) {
            problem.setProperty("code", ErrorCode.INVALID_REQUEST.name());
        }
        return super.createResponseEntity(body, headers, statusCode, request);
    }

    private static ErrorCode code(Enum<?> reason) {
        return ErrorCode.valueOf(reason.name());
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatusCode status, String detail, ErrorCode code) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code.name());
        return ResponseEntity.status(status).body(body);
    }
}
