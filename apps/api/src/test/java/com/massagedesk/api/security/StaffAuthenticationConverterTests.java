package com.massagedesk.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.oauth2.jwt.Jwt;

class StaffAuthenticationConverterTests {

    private final StaffProfileRepository profiles = mock(StaffProfileRepository.class);
    private final StaffAuthenticationConverter converter = new StaffAuthenticationConverter(profiles);

    private static Jwt token(String subject) {
        return Jwt.withTokenValue("t")
                .header("alg", "ES256")
                .subject(subject)
                .claim("role", "authenticated")
                .build();
    }

    private static List<String> names(Collection<? extends GrantedAuthority> authorities) {
        return AuthorityUtils.authorityListToSet(authorities).stream().sorted().toList();
    }

    @Test
    void masterGetsOnlyTheMasterAuthority() {
        UUID id = UUID.randomUUID();
        when(profiles.findById(id)).thenReturn(Optional.of(new StaffProfile(id, StaffRole.MASTER, "M")));

        var auth = converter.convert(token(id.toString()));

        assertThat(names(auth.getAuthorities())).containsExactly("ROLE_MASTER");
    }

    @Test
    void adminGetsOnlyTheAdminAuthority() {
        UUID id = UUID.randomUUID();
        when(profiles.findById(id)).thenReturn(Optional.of(new StaffProfile(id, StaffRole.ADMIN, "A")));

        var auth = converter.convert(token(id.toString()));

        assertThat(names(auth.getAuthorities())).containsExactly("ROLE_ADMIN");
    }

    @Test
    void unknownUserGetsNoAuthorities() {
        UUID id = UUID.randomUUID();
        when(profiles.findById(id)).thenReturn(Optional.empty());

        var auth = converter.convert(token(id.toString()));

        assertThat(auth.getAuthorities()).isEmpty();
    }

    @Test
    void subjectThatIsNotAUuidGetsNoAuthoritiesAndSkipsTheLookup() {
        var auth = converter.convert(token("not-a-uuid"));

        assertThat(auth.getAuthorities()).isEmpty();
        verify(profiles, never()).findById(any());
    }

    @Test
    void principalNameIsTheSubject() {
        UUID id = UUID.randomUUID();
        when(profiles.findById(id)).thenReturn(Optional.empty());

        var auth = converter.convert(token(id.toString()));

        assertThat(auth.getName()).isEqualTo(id.toString());
    }

    @Test
    void theDatabaseRoleClaimIsNeverAnAuthority() {
        UUID id = UUID.randomUUID();
        when(profiles.findById(id)).thenReturn(Optional.of(new StaffProfile(id, StaffRole.MASTER, "M")));

        var auth = converter.convert(token(id.toString()));

        assertThat(names(auth.getAuthorities())).noneMatch(a -> a.toLowerCase().contains("authenticated"));
    }
}
