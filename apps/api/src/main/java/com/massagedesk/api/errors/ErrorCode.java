package com.massagedesk.api.errors;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Machine-readable reason of an error response. Domain codes carry the name of the reason of
 * the exception that caused them; {@link #INVALID_REQUEST} is the code of every client error
 * raised by the web framework or by request checks.
 */
@Schema(enumAsRef = true, description = "machine-readable reason of an error response")
public enum ErrorCode {
    // Domain rules: conflicts with existing data.
    APPOINTMENT_CONFLICT,
    // Domain rules: something that was asked for does not exist.
    APPOINTMENT_NOT_FOUND,
    CLIENT_NOT_FOUND,
    // Domain rules: input the rules refuse.
    INVALID_HOURS,
    INVALID_PHONE,
    // Framework: malformed, mistyped or incomplete request, unknown path, wrong method or media type.
    INVALID_REQUEST,
    INVALID_TIME_OFF,
    // Domain rules: appointment state.
    NOT_CONFIRMED,
    NOT_STARTED,
    OUTSIDE_SCHEDULE,
    PHONE_TAKEN,
    SERVICE_NOT_FOUND,
    TIME_OFF_NOT_FOUND,
    TIME_TAKEN,
    UNKNOWN_TIME_ZONE
}
