package com.massagedesk.api.security;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * The role rule lives in {@code SecurityConfig}: everything outside {@code /admin/**} is open to MASTER and ADMIN only
 * ({@code anyRequest()}). This test keeps every clients, services, working hours, time off and settings operation from
 * leaking to anonymous callers or to tokens without a staff role, and pins the status a staff caller gets for an empty
 * body so a wrong rule cannot hide behind "not 401 and not 403".
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class StaffEndpointsAccessTests {

    private record Operation(HttpMethod method, String path, boolean write, int staffStatus) {
        @Override
        public String toString() {
            return method + " " + path.replaceAll("[0-9a-f]{8}-[0-9a-f-]{27}", "{id}");
        }
    }

    @Autowired
    private MockMvc mvc;

    static Stream<Arguments> operations() {
        String id = UUID.randomUUID().toString();
        return Stream.of(
                        new Operation(HttpMethod.GET, "/clients", false, 200),
                        new Operation(HttpMethod.POST, "/clients", true, 400),
                        new Operation(HttpMethod.GET, "/clients/" + id, false, 404),
                        new Operation(HttpMethod.PATCH, "/clients/" + id, true, 404),
                        new Operation(HttpMethod.GET, "/services", false, 200),
                        new Operation(HttpMethod.POST, "/services", true, 400),
                        new Operation(HttpMethod.PATCH, "/services/" + id, true, 404),
                        new Operation(HttpMethod.GET, "/working-hours", false, 200),
                        new Operation(HttpMethod.PUT, "/working-hours", true, 400),
                        new Operation(HttpMethod.GET, "/time-off?from=2026-11-03&to=2026-11-03", false, 200),
                        new Operation(HttpMethod.POST, "/time-off", true, 400),
                        new Operation(HttpMethod.DELETE, "/time-off/" + id, false, 404),
                        new Operation(HttpMethod.GET, "/settings", false, 200),
                        new Operation(HttpMethod.PATCH, "/settings", true, 200))
                .map(op -> Arguments.of(Named.of(op.toString(), op)));
    }

    private MockHttpServletRequestBuilder build(Operation op) {
        MockHttpServletRequestBuilder builder = request(op.method(), op.path());
        if (op.write()) {
            builder.contentType(MediaType.APPLICATION_JSON).content("{}");
        }
        return builder;
    }

    @ParameterizedTest
    @MethodSource("operations")
    void withoutTokenIsUnauthorized(Operation op) throws Exception {
        mvc.perform(build(op)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @MethodSource("operations")
    void tokenWithoutStaffRoleIsForbidden(Operation op) throws Exception {
        mvc.perform(build(op).with(jwt())).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @MethodSource("operations")
    void masterPassesSecurity(Operation op) throws Exception {
        mvc.perform(build(op).with(as(StaffRole.MASTER))).andExpect(status().is(op.staffStatus()));
    }

    @ParameterizedTest
    @MethodSource("operations")
    void adminPassesSecurity(Operation op) throws Exception {
        mvc.perform(build(op).with(as(StaffRole.ADMIN))).andExpect(status().is(op.staffStatus()));
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor as(StaffRole role) {
        return jwt().authorities(new SimpleGrantedAuthority(role.authority()));
    }
}
