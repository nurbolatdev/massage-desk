package com.massagedesk.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, SecurityRulesTests.Probe.class})
@Transactional
@TestPropertySource(properties = "app.whatsapp.verify-token=secret")
class SecurityRulesTests {

    private static final TestJwks JWKS = new TestJwks();

    @DynamicPropertySource
    static void supabaseUrl(DynamicPropertyRegistry registry) {
        registry.add("app.supabase.url", JWKS::baseUrl);
    }

    @AfterAll
    static void stopJwks() {
        JWKS.stop();
    }

    @Autowired
    private MockMvc mvc;

    @Autowired
    private StaffProfileRepository profiles;

    /** Test-only endpoints to exercise the role rules. */
    @RestController
    static class Probe {

        @GetMapping("/probe")
        String probe() {
            return "ok";
        }

        @GetMapping("/admin/probe")
        String adminProbe() {
            return "ok";
        }
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private UUID staff(StaffRole role) {
        UUID id = UUID.randomUUID();
        profiles.saveAndFlush(new StaffProfile(id, role, role.name()));
        return id;
    }

    @Test
    void withoutTokenIsUnauthorized() throws Exception {
        String challenge = mvc.perform(get("/probe"))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getHeader(HttpHeaders.WWW_AUTHENTICATE);
        assertThat(challenge).startsWith("Bearer");
    }

    @Test
    void tokenSignedWithForeignKeyIsUnauthorized() throws Exception {
        UUID id = staff(StaffRole.MASTER);
        mvc.perform(get("/probe").header(HttpHeaders.AUTHORIZATION, bearer(JWKS.foreignKeyToken(id))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void expiredTokenIsUnauthorized() throws Exception {
        UUID id = staff(StaffRole.MASTER);
        String token = JWKS.token(id, JWKS.baseUrl() + "/auth/v1", List.of("authenticated"),
                Instant.now().minus(1, ChronoUnit.HOURS));
        mvc.perform(get("/probe").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void wrongAudienceIsUnauthorized() throws Exception {
        UUID id = staff(StaffRole.MASTER);
        String token = JWKS.token(id, JWKS.baseUrl() + "/auth/v1", List.of("other"),
                Instant.now().plus(1, ChronoUnit.HOURS));
        mvc.perform(get("/probe").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void wrongIssuerIsUnauthorized() throws Exception {
        UUID id = staff(StaffRole.MASTER);
        String token = JWKS.token(id, "https://evil.example/auth/v1", List.of("authenticated"),
                Instant.now().plus(1, ChronoUnit.HOURS));
        mvc.perform(get("/probe").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void garbageTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/probe").header(HttpHeaders.AUTHORIZATION, "Bearer abc"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validTokenWithoutProfileIsForbidden() throws Exception {
        mvc.perform(get("/probe").header(HttpHeaders.AUTHORIZATION, bearer(JWKS.token(UUID.randomUUID()))))
                .andExpect(status().isForbidden());
    }

    @Test
    void masterSeesProbeButNotAdminProbe() throws Exception {
        String token = JWKS.token(staff(StaffRole.MASTER));
        mvc.perform(get("/probe").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/admin/probe").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminSeesProbeAndAdminProbe() throws Exception {
        String token = JWKS.token(staff(StaffRole.ADMIN));
        mvc.perform(get("/probe").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/admin/probe").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk());
    }

    @Test
    void healthIsOpenWithoutToken() throws Exception {
        mvc.perform(get("/health")).andExpect(status().isOk());
        mvc.perform(get("/health/liveness")).andExpect(status().isOk());
    }

    @Test
    void webhookVerificationIsOpenWithoutToken() throws Exception {
        mvc.perform(get("/webhook/whatsapp")
                        .param("hub.mode", "subscribe")
                        .param("hub.verify_token", "secret")
                        .param("hub.challenge", "12345"))
                .andExpect(status().isOk())
                .andExpect(content().string("12345"));
    }

    @Test
    void webhookPostReachesMvcWithoutToken() throws Exception {
        mvc.perform(post("/webhook/whatsapp")).andExpect(status().isMethodNotAllowed());
    }
}
