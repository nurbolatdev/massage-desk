package com.massagedesk.api.booking;

/** Appointment state; only {@code CONFIRMED} blocks the time (see the exclusion constraint). */
public enum AppointmentStatus {
    CONFIRMED,
    CANCELLED,
    NO_SHOW,
    DONE
}
