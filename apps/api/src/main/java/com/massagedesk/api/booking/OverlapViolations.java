package com.massagedesk.api.booking;

import java.sql.SQLException;

/** Recognises the database refusing an overlapping confirmed appointment. */
final class OverlapViolations {

    /** PostgreSQL exclusion_violation; raised by the {@code appointments_no_overlap} constraint. */
    static final String EXCLUSION_VIOLATION = "23P01";

    private OverlapViolations() {
    }

    static boolean isOverlap(Throwable e) {
        Throwable current = e;
        while (current != null) {
            if (current instanceof SQLException sql && EXCLUSION_VIOLATION.equals(sql.getSQLState())) {
                return true;
            }
            Throwable cause = current.getCause();
            if (cause == current) {
                return false;
            }
            current = cause;
        }
        return false;
    }
}
