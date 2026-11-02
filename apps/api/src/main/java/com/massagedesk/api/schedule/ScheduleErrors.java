package com.massagedesk.api.schedule;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Maps schedule domain errors to HTTP problem responses, shared by the schedule controllers. */
final class ScheduleErrors {

    private ScheduleErrors() {
    }

    static ResponseStatusException http(ScheduleException e) {
        HttpStatus status = switch (e.reason()) {
            case SERVICE_NOT_FOUND, TIME_OFF_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case INVALID_HOURS, INVALID_TIME_OFF -> HttpStatus.UNPROCESSABLE_ENTITY;
            case APPOINTMENT_CONFLICT -> HttpStatus.CONFLICT;
        };
        ResponseStatusException result = new ResponseStatusException(status, e.getMessage(), e);
        if (e.reason() == ScheduleException.Reason.APPOINTMENT_CONFLICT) {
            result.getBody().setProperty("conflicts", e.conflicts().stream().map(AppointmentConflict::from).toList());
        }
        return result;
    }
}
