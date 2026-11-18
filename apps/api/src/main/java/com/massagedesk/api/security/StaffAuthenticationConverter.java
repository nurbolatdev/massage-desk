package com.massagedesk.api.security;

import java.util.List;
import java.util.UUID;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Turns a verified access token into an authentication with the staff role from {@code profiles}.
 *
 * <p>The token's {@code role} claim is the database role ({@code authenticated}) and is ignored.
 * The staff role is looked up by {@code sub} on every request. A token without a profile, or with
 * a {@code sub} that is not a uuid, gets no authorities, so the access rules answer 403.
 */
final class StaffAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final StaffProfileRepository profiles;

    StaffAuthenticationConverter(StaffProfileRepository profiles) {
        this.profiles = profiles;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        return new JwtAuthenticationToken(jwt, authorities(jwt.getSubject()), jwt.getSubject());
    }

    private List<GrantedAuthority> authorities(String subject) {
        if (subject == null) {
            return List.of();
        }
        UUID userId;
        try {
            userId = UUID.fromString(subject);
        } catch (IllegalArgumentException e) {
            return List.of();
        }
        return profiles.findById(userId)
                .<GrantedAuthority>map(p -> new SimpleGrantedAuthority(p.getRole().authority()))
                .map(List::of)
                .orElse(List.of());
    }
}
