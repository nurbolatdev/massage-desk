package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.databind.json.JsonMapper;

class WhatsAppApiPropertiesTests {

    @Test
    void defaultsAndNotConfiguredWhenValuesAreNullOrEmpty() {
        WhatsAppApiProperties fromNulls = new WhatsAppApiProperties(null, null, null, null, null);
        assertThat(fromNulls.url()).isEmpty();
        assertThat(fromNulls.accessToken()).isEmpty();
        assertThat(fromNulls.phoneNumberId()).isEmpty();
        assertThat(fromNulls.connectTimeout()).isEqualTo(Duration.ofSeconds(5));
        assertThat(fromNulls.readTimeout()).isEqualTo(Duration.ofSeconds(15));
        assertThat(fromNulls.configured()).isFalse();
        assertThat(fromNulls.toString()).contains("accessToken=<empty>");

        WhatsAppApiProperties fromEmpty = new WhatsAppApiProperties("", "", "", null, null);
        assertThat(fromEmpty.configured()).isFalse();
    }

    @Test
    void notConfiguredWhenAnyRequiredFieldIsMissing() {
        assertThat(new WhatsAppApiProperties("https://graph.test/v23.0", "token", "", null, null).configured())
                .isFalse();
        assertThat(new WhatsAppApiProperties("https://graph.test/v23.0", "", "123456", null, null).configured())
                .isFalse();
        assertThat(new WhatsAppApiProperties("", "token", "123456", null, null).configured())
                .isFalse();
    }

    @Test
    void configuredWithAllThreeValuesAndStripsTrailingSlash() {
        WhatsAppApiProperties props = new WhatsAppApiProperties(
                "https://graph.test/v23.0/",
                "super-secret-token-value",
                "123456789012345",
                Duration.ofSeconds(3),
                Duration.ofSeconds(20));

        assertThat(props.configured()).isTrue();
        assertThat(props.url()).isEqualTo("https://graph.test/v23.0");
        assertThat(props.accessToken()).isEqualTo("super-secret-token-value");
        assertThat(props.phoneNumberId()).isEqualTo("123456789012345");
        assertThat(props.connectTimeout()).isEqualTo(Duration.ofSeconds(3));
        assertThat(props.readTimeout()).isEqualTo(Duration.ofSeconds(20));
    }

    @Test
    void toStringMasksAccessToken() {
        String secret = "secret-token-987654321";
        WhatsAppApiProperties props = new WhatsAppApiProperties(
                "https://graph.test/v23.0",
                secret,
                "123456",
                Duration.ofSeconds(5),
                Duration.ofSeconds(15));

        assertThat(props.toString())
                .contains("accessToken=***")
                .contains("url=https://graph.test/v23.0")
                .contains("phoneNumberId=123456")
                .doesNotContain(secret);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://graph.test/v23.0",
            "https://graph.test/v23.0?x=1",
            "https://graph.test/v23.0#section",
            "graph.test/v23.0",
            "https:///v23.0",
            "https://user@graph.test/v23.0",
            "https://graph.test/bad path"
    })
    void rejectsInvalidUrlsWithoutLeakingValue(String invalidUrl) {
        assertThatThrownBy(() -> new WhatsAppApiProperties(invalidUrl, "token", "12345", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("app.whatsapp.api.url must be an https URL without query")
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain(invalidUrl));
    }

    @ParameterizedTest
    @ValueSource(strings = {"tok\n", "tok\r", "to ken"})
    void rejectsTokenWithWhitespaceOrControlCharactersWithoutLeakingValue(String badToken) {
        assertThatThrownBy(() -> new WhatsAppApiProperties("https://graph.test/v23.0", badToken, "12345", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("app.whatsapp.api.access-token must not contain whitespace or control characters");
    }

    @ParameterizedTest
    @ValueSource(strings = {"12a", "../1", "+12345", "123456789012345678901234567890123", " "})
    void rejectsInvalidPhoneNumberIdsWithoutLeakingValue(String invalidId) {
        assertThatThrownBy(() -> new WhatsAppApiProperties("https://graph.test/v23.0", "token", invalidId, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("app.whatsapp.api.phone-number-id must be 1..32 digits");
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1, 61})
    void rejectsOutOfRangeTimeouts(long seconds) {
        Duration invalid = Duration.ofSeconds(seconds);
        assertThatThrownBy(() -> new WhatsAppApiProperties(
                "https://graph.test/v23.0", "token", "12345", invalid, Duration.ofSeconds(15)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("app.whatsapp.api.connect-timeout");

        assertThatThrownBy(() -> new WhatsAppApiProperties(
                "https://graph.test/v23.0", "token", "12345", Duration.ofSeconds(5), invalid))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("app.whatsapp.api.read-timeout");
    }

    @Test
    void acceptsBoundaryTimeouts() {
        WhatsAppApiProperties props = new WhatsAppApiProperties(
                "https://graph.test/v23.0",
                "token",
                "12345",
                Duration.ofMillis(1),
                Duration.ofSeconds(60));
        assertThat(props.connectTimeout()).isEqualTo(Duration.ofMillis(1));
        assertThat(props.readTimeout()).isEqualTo(Duration.ofSeconds(60));
    }

    @Test
    void contextBindsPropertiesFromConfiguration() {
        new ApplicationContextRunner()
                .withBean(JsonMapper.class, () -> JsonMapper.builder().build())
                .withUserConfiguration(WhatsAppConfig.class)
                .withPropertyValues(
                        "app.whatsapp.api.url=https://graph.test/v23.0/",
                        "app.whatsapp.api.access-token=my-secret-token",
                        "app.whatsapp.api.phone-number-id=987654321",
                        "app.whatsapp.api.connect-timeout=4s",
                        "app.whatsapp.api.read-timeout=12s")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    WhatsAppApiProperties props = context.getBean(WhatsAppApiProperties.class);
                    assertThat(props.configured()).isTrue();
                    assertThat(props.url()).isEqualTo("https://graph.test/v23.0");
                    assertThat(props.phoneNumberId()).isEqualTo("987654321");
                    assertThat(props.connectTimeout()).isEqualTo(Duration.ofSeconds(4));
                    assertThat(props.readTimeout()).isEqualTo(Duration.ofSeconds(12));
                });
    }
}
