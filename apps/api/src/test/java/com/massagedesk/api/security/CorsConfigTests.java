package com.massagedesk.api.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class CorsConfigTests {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class))
            .withUserConfiguration(CorsConfig.class);

    @ParameterizedTest
    @ValueSource(strings = {"https://admin.example.com", "http://localhost:5173"})
    void startsWithAValidOrigin(String origin) {
        runner.withPropertyValues("app.cors.admin-origin=" + origin)
                .run(context -> assertThat(context).hasNotFailed());
    }

    @ParameterizedTest
    @ValueSource(strings = {"*", "", "https://a.example/", "https://a.example/path", "a.example",
            "https://*.example", "https://a.example?x", "https://user@a.example", "https://a.example:",
            "https://a.example:abc"})
    void failsOnAnInvalidOrigin(String origin) {
        runner.withPropertyValues("app.cors.admin-origin=" + origin)
                .run(context -> assertThat(context).hasFailed());
    }
}
