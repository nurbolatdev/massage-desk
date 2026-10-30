package com.massagedesk.api.events;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

/** An append-only record of something that happened, written in the same transaction as the change. */
@Entity
@Table(name = "events")
public class DomainEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Convert(converter = DomainEventTypeConverter.class)
    @Column(name = "type", nullable = false, updatable = false)
    private DomainEventType type;

    @Column(name = "entity_type", nullable = false, updatable = false)
    private String entityType;

    @Column(name = "entity_id", updatable = false)
    private UUID entityId;

    @Convert(converter = EventActorConverter.class)
    @Column(name = "actor", nullable = false, updatable = false)
    private EventActor actor;

    /** JSON object text. */
    @Column(name = "payload", nullable = false, columnDefinition = "jsonb", updatable = false)
    @ColumnTransformer(write = "cast(? as jsonb)")
    private String payload;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected DomainEvent() {
    }

    DomainEvent(DomainEventType type, UUID entityId, EventActor actor, String payload) {
        this.type = Objects.requireNonNull(type, "type");
        this.entityType = type.entityType();
        this.entityId = entityId;
        this.actor = Objects.requireNonNull(actor, "actor");
        this.payload = Objects.requireNonNull(payload, "payload");
    }

    public UUID getId() {
        return id;
    }

    public DomainEventType getType() {
        return type;
    }

    public String getEntityType() {
        return entityType;
    }

    public UUID getEntityId() {
        return entityId;
    }

    public EventActor getActor() {
        return actor;
    }

    public String getPayload() {
        return payload;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
