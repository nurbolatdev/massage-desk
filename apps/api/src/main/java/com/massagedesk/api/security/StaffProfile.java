package com.massagedesk.api.security;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;
import java.util.UUID;

/** A staff member: the auth user id with the role that decides what the API lets them do. */
@Entity
@Table(name = "profiles")
public class StaffProfile {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Convert(converter = StaffRoleConverter.class)
    @Column(name = "role", nullable = false)
    private StaffRole role;

    @Column(name = "display_name")
    private String displayName;

    protected StaffProfile() {
    }

    public StaffProfile(UUID userId, StaffRole role, String displayName) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.role = Objects.requireNonNull(role, "role");
        this.displayName = displayName;
    }

    public UUID getUserId() {
        return userId;
    }

    public StaffRole getRole() {
        return role;
    }

    public String getDisplayName() {
        return displayName;
    }
}
