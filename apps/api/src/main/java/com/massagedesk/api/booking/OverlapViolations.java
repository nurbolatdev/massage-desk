package com.massagedesk.api.booking;

import com.massagedesk.api.persistence.SqlStates;

/** Recognises the database refusing an overlapping confirmed appointment. */
final class OverlapViolations {

    /** PostgreSQL exclusion_violation; raised by the {@code appointments_no_overlap} constraint. */
    static final String EXCLUSION_VIOLATION = SqlStates.EXCLUSION_VIOLATION;

    private OverlapViolations() {
    }

    static boolean isOverlap(Throwable e) {
        return SqlStates.has(e, SqlStates.EXCLUSION_VIOLATION);
    }
}
