package com.massagedesk.api.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.Assert;

/**
 * Startup check for the Supabase URL that token verification depends on.
 *
 * <p>The property binder leaves an unresolved {@code ${SUPABASE_URL}} as literal text and the
 * application would start rejecting every staff request. Reading the value with {@code @Value}
 * resolves placeholders strictly, so a missing variable fails startup; a trailing slash is
 * rejected because the issuer and JWKS addresses are built by appending paths.
 */
@Configuration(proxyBeanMethods = false)
class SupabaseUrlConfig {

    @Bean
    SupabaseUrl supabaseUrl(@Value("${app.supabase.url}") String url) {
        Assert.hasText(url, "SUPABASE_URL must not be empty");
        Assert.isTrue(!url.endsWith("/"), "SUPABASE_URL must not end with a slash: " + url);
        return new SupabaseUrl(url);
    }

    /** Validated base address of the Supabase project. */
    record SupabaseUrl(String value) {
    }
}
