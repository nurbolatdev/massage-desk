package com.massagedesk.api.clients;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

/** A person who books massages, identified by phone number (E.164). */
@Entity
@Table(name = "clients")
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "phone", nullable = false, unique = true)
    private String phone;

    @Column(name = "name")
    private String name;

    @Column(name = "notes")
    private String notes;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected Client() {
    }

    public Client(String phone, String name) {
        this(phone, name, null);
    }

    public Client(String phone, String name, String notes) {
        Objects.requireNonNull(phone, "phone");
        if (!PhoneNumbers.isE164(phone)) {
            throw new IllegalArgumentException("phone must be E.164");
        }
        this.phone = phone;
        this.name = clean(name);
        this.notes = clean(notes);
    }

    /** Sets the name; blank clears it. */
    public void rename(String name) {
        this.name = clean(name);
    }

    /** Sets the notes; blank clears them. */
    public void changeNotes(String notes) {
        this.notes = clean(notes);
    }

    private static String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public UUID getId() {
        return id;
    }

    public String getPhone() {
        return phone;
    }

    public String getName() {
        return name;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
