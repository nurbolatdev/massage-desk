package com.massagedesk.api.security;

import com.massagedesk.api.events.EventActor;
import org.springframework.security.core.Authentication;

/** Maps the authenticated staff member to the actor recorded in domain events. */
public final class StaffActors {

    private StaffActors() {
    }

    public static EventActor of(Authentication authentication) {
        boolean admin = authentication.getAuthorities().stream()
                .anyMatch(a -> StaffRole.ADMIN.authority().equals(a.getAuthority()));
        return admin ? EventActor.ADMIN : EventActor.MASTER;
    }
}
