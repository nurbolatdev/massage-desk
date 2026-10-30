package com.massagedesk.api.events;

/**
 * Kind of domain event. Stored as the lowercase constant name; the database only checks the
 * format, so a new type needs no migration.
 */
public enum DomainEventType {
    CLIENT_CREATED("client"),
    APPOINTMENT_CREATED("appointment"),
    APPOINTMENT_RESCHEDULED("appointment"),
    APPOINTMENT_CANCELLED("appointment"),
    APPOINTMENT_NO_SHOW("appointment");

    private final String entityType;

    DomainEventType(String entityType) {
        this.entityType = entityType;
    }

    /** Kind of entity the event is about, as stored in {@code events.entity_type}. */
    public String entityType() {
        return entityType;
    }
}
