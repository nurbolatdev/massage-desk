package com.massagedesk.api.persistence;

import java.sql.SQLException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

/** Helpers for recognising PostgreSQL errors by SQLState. */
public final class SqlStates {

    /** PostgreSQL unique_violation. */
    public static final String UNIQUE_VIOLATION = "23505";

    /** PostgreSQL exclusion_violation. */
    public static final String EXCLUSION_VIOLATION = "23P01";

    private SqlStates() {
    }

    /** True when the cause chain of {@code e} contains an SQLException with the given SQLState. */
    public static boolean has(Throwable e, String sqlState) {
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        Throwable current = e;
        while (current != null && seen.add(current)) {
            if (current instanceof SQLException sql && sqlState.equals(sql.getSQLState())) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
