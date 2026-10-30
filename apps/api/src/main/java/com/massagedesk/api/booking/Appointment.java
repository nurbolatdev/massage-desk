package com.massagedesk.api.booking;

import com.massagedesk.api.clients.Client;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.TimeRange;
import com.massagedesk.api.schedule.TimeRangeConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

/** A client's booking of a service for a time range. */
@Entity
@Table(name = "appointments")
public class Appointment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id", nullable = false)
    private MassageService service;

    @Convert(converter = TimeRangeConverter.class)
    @Column(name = "period", nullable = false, columnDefinition = "tstzrange")
    @ColumnTransformer(write = "cast(? as tstzrange)")
    private TimeRange period;

    @Convert(converter = AppointmentStatusConverter.class)
    @Column(name = "status", nullable = false)
    private AppointmentStatus status;

    @Convert(converter = AppointmentSourceConverter.class)
    @Column(name = "source", nullable = false)
    private AppointmentSource source;

    @Column(name = "reminder_sent_at")
    private Instant reminderSentAt;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected Appointment() {
    }

    public Appointment(Client client, MassageService service, TimeRange period, AppointmentSource source) {
        this.client = Objects.requireNonNull(client, "client");
        this.service = Objects.requireNonNull(service, "service");
        this.period = Objects.requireNonNull(period, "period");
        this.source = Objects.requireNonNull(source, "source");
        this.status = AppointmentStatus.CONFIRMED;
    }

    public UUID getId() {
        return id;
    }

    public Client getClient() {
        return client;
    }

    public MassageService getService() {
        return service;
    }

    public TimeRange getPeriod() {
        return period;
    }

    public AppointmentStatus getStatus() {
        return status;
    }

    public AppointmentSource getSource() {
        return source;
    }

    public Instant getReminderSentAt() {
        return reminderSentAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
