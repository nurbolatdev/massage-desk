package com.massagedesk.api.security;

import static org.springframework.security.config.Customizer.withDefaults;

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
 * {@code /error} is open so error dispatches are not rewritten to 401. Everything else
 * needs a valid Supabase access token. CSRF is off: tokens travel in a header, there
 * are no cookies.
 */
@Configuration(proxyBeanMethods = false)
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .oauth2ResourceServer(o -> o.jwt(withDefaults()))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/health", "/health/**", "/webhook/whatsapp", "/error").permitAll()
                        .anyRequest().authenticated());
        return http.build();
    }
}
