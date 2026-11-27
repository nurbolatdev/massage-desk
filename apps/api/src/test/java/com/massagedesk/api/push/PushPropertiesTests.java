package com.massagedesk.api.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class PushPropertiesTests {

    @Test
    void defaultsAndNotConfiguredWhenValuesAreNullOrEmpty() {
        PushProperties fromNulls = new PushProperties(null, null, null, null);
        assertThat(fromNulls.url()).isEmpty();
        assertThat(fromNulls.accessToken()).isEmpty();
        assertThat(fromNulls.connectTimeout()).isEqualTo(Duration.ofSeconds(5));
        assertThat(fromNulls.readTimeout()).isEqualTo(Duration.ofSeconds(10));
        assertThat(fromNulls.configured()).isFalse();
        assertThat(fromNulls.toString()).contains("accessToken=<empty>");

        PushProperties fromEmpty = new PushProperties("", "token", null, null);
        assertThat(fromEmpty.url()).isEmpty();
        assertThat(fromEmpty.configured()).isFalse();
    }

    @Test
    void configuredWithValidHttpsUrlKeepsTrailingSlashAndTokenIsOptional() {
        PushProperties withoutToken = new PushProperties(
                "https://exp.host/--/api/v2/push/send",
                "",
                null,
                null);
        assertThat(withoutToken.configured()).isTrue();
        assertThat(withoutToken.url()).isEqualTo("https://exp.host/--/api/v2/push/send");
        assertThat(withoutToken.accessToken()).isEmpty();

        PushProperties withTrailingSlash = new PushProperties(
                "https://push.test/--/api/v2/push/send/",
                "super-secret-token-value",
                Duration.ofSeconds(3),
                Duration.ofSeconds(20));
        assertThat(withTrailingSlash.configured()).isTrue();
        assertThat(withTrailingSlash.url()).isEqualTo("https://push.test/--/api/v2/push/send/");
        assertThat(withTrailingSlash.accessToken()).isEqualTo("super-secret-token-value");
        assertThat(withTrailingSlash.connectTimeout()).isEqualTo(Duration.ofSeconds(3));
        assertThat(withTrailingSlash.readTimeout()).isEqualTo(Duration.ofSeconds(20));
    }

    @Test
    void toStringMasksAccessToken() {
        String secret = "secret-push-token-987654321";
        PushProperties props = new PushProperties(
                "https://exp.host/--/api/v2/push/send",
                secret,
                Duration.ofSeconds(5),
                Duration.ofSeconds(10));

        assertThat(props.toString())
                .contains("accessToken=***")
                .contains("url=https://exp.host/--/api/v2/push/send")
                .doesNotContain(secret);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://exp.host/--/api/v2/push/send",
            "ftp://exp.host/--/api/v2/push/send",
            "https:///--/api/v2/push/send",
            "exp.host/--/api/v2/push/send",
            "https://exp.host/--/api/v2/push/send?q=1",
            "https://exp.host/--/api/v2/push/send#f",
            "https://u:p@exp.host/x",
            "https://exp.host/bad path"
    })
    void rejectsInvalidUrlsWithoutLeakingValue(String invalidUrl) {
        assertThatThrownBy(() -> new PushProperties(invalidUrl, "token", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("app.push.url must be an https URL without query")
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain(invalidUrl));
    }

    @ParameterizedTest
    @ValueSource(strings = {" ", "   ", "\t"})
    void rejectsBlankAccessToken(String blankToken) {
        assertThatThrownBy(() -> new PushProperties(
                "https://exp.host/--/api/v2/push/send", blankToken, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("app.push.access-token must not be blank");
    }

    @ParameterizedTest
    @ValueSource(strings = {"tok\n", "tok\r", "to ken"})
    void rejectsTokenWithWhitespaceOrControlCharactersWithoutLeakingValue(String badToken) {
        assertThatThrownBy(() -> new PushProperties(
                "https://exp.host/--/api/v2/push/send", badToken, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("app.push.access-token must not contain whitespace or control characters")
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain(badToken));
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1, 61})
    void rejectsOutOfRangeTimeouts(long seconds) {
        Duration invalid = Duration.ofSeconds(seconds);
        assertThatThrownBy(() -> new PushProperties(
                "https://exp.host/--/api/v2/push/send", "", invalid, Duration.ofSeconds(10)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("app.push.connect-timeout");

        assertThatThrownBy(() -> new PushProperties(
                "https://exp.host/--/api/v2/push/send", "", Duration.ofSeconds(5), invalid))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("app.push.read-timeout");
    }

    @Test
    void acceptsBoundaryTimeouts() {
        PushProperties props = new PushProperties(
                "https://exp.host/--/api/v2/push/send",
                "token",
                Duration.ofMillis(1),
                Duration.ofSeconds(60));
        assertThat(props.connectTimeout()).isEqualTo(Duration.ofMillis(1));
        assertThat(props.readTimeout()).isEqualTo(Duration.ofSeconds(60));
    }

    @Test
    void contextBindsPropertiesFromConfiguration() {
        new ApplicationContextRunner()
                .withUserConfiguration(PushConfig.class)
                .withPropertyValues(
                        "app.push.url=https://push.test/--/api/v2/push/send/",
                        "app.push.access-token=my-secret-token",
                        "app.push.connect-timeout=4s",
                        "app.push.read-timeout=12s")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    PushProperties props = context.getBean(PushProperties.class);
                    assertThat(props.configured()).isTrue();
                    assertThat(props.url()).isEqualTo("https://push.test/--/api/v2/push/send/");
                    assertThat(props.accessToken()).isEqualTo("my-secret-token");
                    assertThat(props.connectTimeout()).isEqualTo(Duration.ofSeconds(4));
                    assertThat(props.readTimeout()).isEqualTo(Duration.ofSeconds(12));
                });
    }

    @Test
    void contextStartsNotConfiguredWithoutPushProperties() {
        new ApplicationContextRunner()
                .withUserConfiguration(PushConfig.class)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    PushProperties props = context.getBean(PushProperties.class);
                    assertThat(props.configured()).isFalse();
                    assertThat(props.url()).isEmpty();
                    assertThat(props.accessToken()).isEmpty();
                    assertThat(props.connectTimeout()).isEqualTo(Duration.ofSeconds(5));
                    assertThat(props.readTimeout()).isEqualTo(Duration.ofSeconds(10));
                });
    }
}
