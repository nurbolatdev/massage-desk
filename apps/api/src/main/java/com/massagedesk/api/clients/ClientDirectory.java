package com.massagedesk.api.clients;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
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

    record Row(UUID id, String phone, String name, String notes, Instant createdAt, VisitStats stats) {
    }

    record Summary(long total, long newClients) {
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

    List<Row> page(String namePattern, String phonePattern, ClientSegment segment, Instant now, int limit, int offset) {
        String search = namePattern == null
                ? "true"
                : "(lower(c.name) like lower(:name) escape '\\' or c.phone like :phone)";
        String segmentFilter = segment == null ? "true" : segment.sqlCondition();
        String sql = "select c.id, c.phone, c.name, c.notes, c.created_at, st.*\n"
                + "from clients c\n"
                + "left join (" + STATS + ") st on st.client_id = c.id\n"
                + "where " + search + " and " + segmentFilter + "\n"
                + "order by lower(c.name) asc nulls last, c.phone asc\n"
                + "limit :limit offset :offset";
        JdbcClient.StatementSpec spec = jdbc.sql(sql)
                .param("now", now.atOffset(ZoneOffset.UTC))
                .param("limit", limit)
                .param("offset", offset);
        if (namePattern != null) {
            spec = spec.param("name", namePattern).param("phone", phonePattern);
        }
        if (segment != null) {
            spec = spec.param("minVisits", ClientSegment.REGULAR_MIN_VISITS)
                    .param("recentFrom", now.minus(ClientSegment.LAPSED_AFTER).atOffset(ZoneOffset.UTC));
        }
        return spec.query((rs, rowNum) -> row(rs)).list();
    }

    Summary summary(Instant since) {
        return jdbc.sql("""
                select count(*) as total,
                       count(*) filter (where created_at >= cast(:since as timestamptz)) as new_clients
                from clients""")
                .param("since", since.atOffset(ZoneOffset.UTC))
                .query((rs, rowNum) -> new Summary(rs.getLong("total"), rs.getLong("new_clients")))
                .single();
    }

    private static Row row(ResultSet rs) throws SQLException {
        return new Row(
                rs.getObject("id", UUID.class),
                rs.getString("phone"),
                rs.getString("name"),
                rs.getString("notes"),
                instant(rs, "created_at"),
                stats(rs));
    }

    static VisitStats stats(ResultSet rs) throws SQLException {
        if (rs.getObject("client_id", UUID.class) == null) {
            return VisitStats.NONE;
        }
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
