package com.massagedesk.api.errors;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Machine-readable reason of an error response. Domain codes carry the name of the reason of
 * the exception that caused them; {@link #INVALID_REQUEST} is the code of every client error
 * raised by the web framework or by request checks.
 */
@Schema(enumAsRef = true, description = "machine-readable reason of an error response")
public enum ErrorCode {
    /** Confirmed appointments are in the way of the change. */
    APPOINTMENT_CONFLICT,
    /** No appointment with this id. */
    APPOINTMENT_NOT_FOUND,
    /** No client with this id. */
    CLIENT_NOT_FOUND,
    /** A working-hours block is not valid. */
    INVALID_HOURS,
    /** The phone number is not valid. */
    INVALID_PHONE,
    /** Framework / request checks; every other constant is a domain reason name. */
    INVALID_REQUEST,
    /** The time off period is not valid. */
    INVALID_TIME_OFF,
    /** The appointment is not confirmed any more. */
    NOT_CONFIRMED,
    /** The appointment has not started yet. */
    NOT_STARTED,
    /** The time is outside working hours, in time off or in the past. */
    OUTSIDE_SCHEDULE,
    /** Another client already has this phone number. */
    PHONE_TAKEN,
    /** No service with this id. */
    SERVICE_NOT_FOUND,
    /** No time off with this id. */
    TIME_OFF_NOT_FOUND,
    /** The time is already booked. */
    TIME_TAKEN,
    /** The time zone is not known. */
    UNKNOWN_TIME_ZONE
}
