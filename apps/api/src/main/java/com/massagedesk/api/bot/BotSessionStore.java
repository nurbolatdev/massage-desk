package com.massagedesk.api.bot;

import com.massagedesk.api.bot.BotSession.Step;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class BotSessionStore {

    record Loaded(boolean humanMode, @Nullable BotSession session, @Nullable Instant updatedAt) {
    }

    private final JdbcClient jdbc;

    BotSessionStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    Optional<Loaded> load(UUID conversationId) {
        Objects.requireNonNull(conversationId, "conversationId");
        return jdbc.sql("""
                select v.human_mode,
                       s.step,
                       s.service_id,
                       s.day,
                       s.start_at,
                       s.appointment_id,
                       s.updated_at
                from conversations v
                left join bot_sessions s on s.conversation_id = v.id
                where v.id = :id""")
                .param("id", conversationId)
                .query((rs, rowNum) -> {
                    boolean humanMode = rs.getBoolean("human_mode");
                    Optional<Step> step = Step.of(rs.getString("step"));
                    if (step.isEmpty()) {
                        return new Loaded(humanMode, null, null);
                    }
                    OffsetDateTime startAt = rs.getObject("start_at", OffsetDateTime.class);
                    OffsetDateTime updatedAt = rs.getObject("updated_at", OffsetDateTime.class);
                    BotSession session = new BotSession(
                            step.get(),
                            rs.getObject("service_id", UUID.class),
                            rs.getObject("day", LocalDate.class),
                            startAt == null ? null : startAt.toInstant(),
                            rs.getObject("appointment_id", UUID.class));
                    return new Loaded(
                            humanMode,
                            session,
                            updatedAt == null ? null : updatedAt.toInstant());
                })
                .optional();
    }

    void save(UUID conversationId, BotSession session, Instant at) {
        Objects.requireNonNull(conversationId, "conversationId");
        Objects.requireNonNull(session, "session");
        Objects.requireNonNull(at, "at");
        OffsetDateTime startAt = session.start() == null ? null : session.start().atOffset(ZoneOffset.UTC);
        jdbc.sql("""
                insert into bot_sessions (conversation_id, step, service_id, day, start_at, appointment_id, updated_at)
                values (
                    :conversationId,
                    :step,
                    cast(:serviceId as uuid),
                    cast(:day as date),
                    cast(:startAt as timestamptz),
                    cast(:appointmentId as uuid),
                    cast(:at as timestamptz)
                )
                on conflict (conversation_id) do update set
                    step = excluded.step,
                    service_id = excluded.service_id,
                    day = excluded.day,
                    start_at = excluded.start_at,
                    appointment_id = excluded.appointment_id,
                    updated_at = excluded.updated_at""")
                .param("conversationId", conversationId)
                .param("step", session.step().column())
                .param("serviceId", session.serviceId())
                .param("day", session.day())
                .param("startAt", startAt)
                .param("appointmentId", session.appointmentId())
                .param("at", at.atOffset(ZoneOffset.UTC))
                .update();
    }

    boolean claim(UUID conversationId, Step step, Instant updatedAt, Instant at) {
        Objects.requireNonNull(conversationId, "conversationId");
        Objects.requireNonNull(step, "step");
        Objects.requireNonNull(updatedAt, "updatedAt");
        Objects.requireNonNull(at, "at");
        return jdbc.sql("""
                update bot_sessions
                set step = 'menu', service_id = null, day = null, start_at = null,
                    appointment_id = null, updated_at = cast(:at as timestamptz)
                where conversation_id = :id and step = :step
                  and updated_at = cast(:updatedAt as timestamptz)""")
                .param("id", conversationId)
                .param("step", step.column())
                .param("updatedAt", updatedAt.atOffset(ZoneOffset.UTC))
                .param("at", at.atOffset(ZoneOffset.UTC))
                .update() == 1;
    }
}
