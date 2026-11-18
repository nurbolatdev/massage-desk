package com.massagedesk.api.booking;

import com.massagedesk.api.schedule.TimeRange;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.UUID;

/**
 * Recorded response for a {@code POST /appointments} request with an {@code Idempotency-Key}.
 * Rows expire after 24 hours and are deleted lazily by the API.
 */
@Entity
@Table(name = "idempotency_keys")
public class IdempotencyKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "idempotency_key", nullable = false)
    private UUID idempotencyKey;

    @Column(name = "appointment_id", nullable = false)
    private UUID appointmentId;

    @Column(name = "client_id", nullable = false)
    private UUID clientId;

    @Column(name = "service_id", nullable = false)
    private UUID serviceId;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected IdempotencyKey() {
    }

    public IdempotencyKey(
            UUID userId,
            UUID idempotencyKey,
            UUID appointmentId,
            UUID clientId,
            UUID serviceId,
            TimeRange period,
            Instant createdAt) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.idempotencyKey = Objects.requireNonNull(idempotencyKey, "idempotencyKey");
        this.appointmentId = Objects.requireNonNull(appointmentId, "appointmentId");
        this.clientId = Objects.requireNonNull(clientId, "clientId");
        this.serviceId = Objects.requireNonNull(serviceId, "serviceId");
        Objects.requireNonNull(period, "period");
        this.startAt = period.start();
        this.endAt = period.end();
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt").truncatedTo(ChronoUnit.MICROS);
    }

    /** Whether the stored fingerprint matches the incoming booking request. */
    public boolean sameRequest(UUID clientId, UUID serviceId, Instant start) {
        Objects.requireNonNull(clientId, "clientId");
        Objects.requireNonNull(serviceId, "serviceId");
        Objects.requireNonNull(start, "start");
        return this.clientId.equals(clientId)
                && this.serviceId.equals(serviceId)
                && this.startAt.equals(start.truncatedTo(ChronoUnit.MICROS));
    }

    /** Appointment time range as it was created. */
    public TimeRange period() {
        return new TimeRange(startAt, endAt);
    }

    public UUID getAppointmentId() {
        return appointmentId;
    }

    public UUID getClientId() {
        return clientId;
    }

    public UUID getServiceId() {
        return serviceId;
    }
}
