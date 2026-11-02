package com.massagedesk.api.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * HTTP security: stateless bearer-token API.
 *
 * <p>Open paths: {@code /health} and {@code /health/**} (load balancer probes) and
 * {@code /webhook/whatsapp} (Meta sends no token; the verify token protects it).
 * {@code /error} is open so error dispatches are not rewritten to 401. {@code /admin/**}
 * needs the admin role; everything else needs a staff role (master or admin), so new
 * endpoints are closed by default. The role comes from {@code profiles}, not from the token.
 * No or invalid token gives 401; a valid token without a profile or with the wrong role
 * gives 403. CSRF is off: tokens travel in a header, there are no cookies.
 */
@Configuration(proxyBeanMethods = false)
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, StaffProfileRepository profiles)
            throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .oauth2ResourceServer(o -> o.jwt(
                        j -> j.jwtAuthenticationConverter(new StaffAuthenticationConverter(profiles))))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/health", "/health/**", "/webhook/whatsapp", "/error").permitAll()
                        .requestMatchers("/admin/**").hasRole(StaffRole.ADMIN.name())
                        .anyRequest().hasAnyRole(StaffRole.MASTER.name(), StaffRole.ADMIN.name()));
        return http.build();
    }
}
