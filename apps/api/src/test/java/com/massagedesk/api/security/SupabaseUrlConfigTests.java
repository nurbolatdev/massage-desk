package com.massagedesk.api.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class SupabaseUrlConfigTests {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class))
            .withUserConfiguration(SupabaseUrlConfig.class);

    @Test
    void startsWithAValidUrl() {
        runner.withPropertyValues("app.supabase.url=https://abc.supabase.co")
                .run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    void failsWhenTheVariableIsNotSet() {
        runner.withPropertyValues("app.supabase.url=${SUPABASE_URL_NOT_SET_IN_TESTS}")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void failsOnTrailingSlash() {
        runner.withPropertyValues("app.supabase.url=https://abc.supabase.co/")
                .run(context -> assertThat(context).hasFailed());
    }
}
