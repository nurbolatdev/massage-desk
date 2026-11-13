package com.massagedesk.api.security;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.Assert;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Cross-origin access for the admin web app.
 *
 * <p>Only the origin from {@code ADMIN_ORIGIN} is allowed. A wildcard is never accepted: the API
 * is called with a bearer token, and any site could otherwise drive it from a visitor's browser.
 * The value is checked at startup: it must be {@code http(s)://host[:port]} without a path or a
 * trailing slash, because browsers compare the origin as an exact string. Credentials are off
 * (the token travels in a header, there are no cookies).
 */
@Configuration(proxyBeanMethods = false)
class CorsConfig {

    private static final String ORIGIN_PATTERN = "^https?://[A-Za-z0-9.-]+(:\\d{1,5})?$";

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${app.cors.admin-origin}") String origin) {
        Assert.hasText(origin, "ADMIN_ORIGIN must not be empty");
        Assert.isTrue(origin.matches(ORIGIN_PATTERN),
                "ADMIN_ORIGIN must look like https://host[:port], without a path, a trailing slash or '*': "
                        + origin);
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(origin));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
