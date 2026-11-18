package com.massagedesk.api.security;

import com.massagedesk.api.events.EventActor;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/** Maps the authenticated staff member to their event actor and user id. */
public final class StaffActors {

    private StaffActors() {
    }

    public static EventActor of(Authentication authentication) {
        boolean admin = authentication.getAuthorities().stream()
                .anyMatch(a -> StaffRole.ADMIN.authority().equals(a.getAuthority()));
        return admin ? EventActor.ADMIN : EventActor.MASTER;
    }

    /** The staff member's user id: the token subject, which the authentication converter already checked against profiles. */
    public static UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
