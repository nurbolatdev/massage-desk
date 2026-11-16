package com.massagedesk.api.clients;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Read model of the client list. Reads {@code appointments} and {@code services} directly in SQL
 * (statuses are matched as strings); the visit rule lives only in {@link #VISIT}.
 */
@Repository
class ClientDirectory {

    record VisitStats(
            int visits,
            BigDecimal totalSpent,
            int noShows,
            Instant firstVisitAt,
            Instant lastVisitAt,
            Instant nextAppointmentAt) {

        static final VisitStats NONE = new VisitStats(0, BigDecimal.ZERO, 0, null, null, null);
    }

    static final String VISIT =
            "(a.status = 'done' or (a.status = 'confirmed' and upper(a.period) <= cast(:now as timestamptz)))";

    static final String STATS = "select a.client_id,\n"
            + "       count(*) filter (where " + VISIT + ") as visits,\n"
            + "       coalesce(sum(s.price) filter (where " + VISIT + "), 0) as total_spent,\n"
            + "       count(*) filter (where a.status = 'no_show') as no_shows,\n"
            + "       min(lower(a.period)) filter (where " + VISIT + ") as first_visit_at,\n"
            + "       max(lower(a.period)) filter (where " + VISIT + ") as last_visit_at,\n"
            + "       min(lower(a.period)) filter (where a.status = 'confirmed'"
            + " and lower(a.period) >= cast(:now as timestamptz)) as next_appointment_at\n"
            + "from appointments a join services s on s.id = a.service_id\n"
            + "group by a.client_id";

    private final JdbcClient jdbc;

    ClientDirectory(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    VisitStats statsOf(UUID clientId, Instant now) {
        return jdbc.sql("select st.* from (" + STATS + ") st where st.client_id = :clientId")
                .param("clientId", clientId)
                .param("now", now.atOffset(ZoneOffset.UTC))
                .query((rs, rowNum) -> stats(rs))
                .optional()
                .orElse(VisitStats.NONE);
    }

    static VisitStats stats(ResultSet rs) throws SQLException {
        return new VisitStats(
                rs.getInt("visits"),
                rs.getBigDecimal("total_spent"),
                rs.getInt("no_shows"),
                instant(rs, "first_visit_at"),
                instant(rs, "last_visit_at"),
                instant(rs, "next_appointment_at"));
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime odt = rs.getObject(column, OffsetDateTime.class);
        return odt == null ? null : odt.toInstant();
    }
}
