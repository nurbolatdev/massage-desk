package com.massagedesk.api.clients;

import java.time.Duration;
import java.util.Locale;

/**
 * Segments for filtering the client list.
 *
 * <ul>
 *   <li>{@link #REGULAR}: at least {@value #REGULAR_MIN_VISITS} visits and either a visit in the last
 *       60 days or an upcoming confirmed appointment.
 *   <li>{@link #LAPSED}: at least 1 visit, no upcoming confirmed appointment, and the last visit is
 *       more than 60 days ago.
 *   <li>{@link #NO_SHOWS}: at least 1 appointment marked {@code no_show}.
 * </ul>
 */
public enum ClientSegment {
    REGULAR("coalesce(st.visits, 0) >= :minVisits"
            + " and (st.last_visit_at >= cast(:recentFrom as timestamptz) or st.next_appointment_at is not null)"),
    LAPSED("coalesce(st.visits, 0) >= 1"
            + " and st.next_appointment_at is null"
            + " and st.last_visit_at < cast(:recentFrom as timestamptz)"),
    NO_SHOWS("coalesce(st.no_shows, 0) >= 1");

    static final int REGULAR_MIN_VISITS = 3;
    static final Duration LAPSED_AFTER = Duration.ofDays(60);

    private final String sqlCondition;

    ClientSegment(String sqlCondition) {
        this.sqlCondition = sqlCondition;
    }

    String sqlCondition() {
        return sqlCondition;
    }

    /** Parses the lowercase query parameter ({@code regular}, {@code lapsed}, {@code no_shows}), or {@code null}. */
    public static ClientSegment fromParam(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        for (ClientSegment segment : values()) {
            if (segment.name().toLowerCase(Locale.ROOT).equals(value)) {
                return segment;
            }
        }
        throw new IllegalArgumentException("unknown client segment: " + value);
    }
}
