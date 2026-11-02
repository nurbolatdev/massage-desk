package com.massagedesk.api.security;

/** Role of a staff member, stored in {@code profiles.role}. */
public enum StaffRole {
    MASTER,
    ADMIN;

    /** Spring Security authority name for this role. */
    public String authority() {
        return "ROLE_" + name();
    }
}
