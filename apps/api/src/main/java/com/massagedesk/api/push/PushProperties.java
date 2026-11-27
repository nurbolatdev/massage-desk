package com.massagedesk.api.push;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Expo Push API settings from {@code application.yml}.
 *
 * <p>{@code url} is the full send endpoint (not a base URL). An empty {@code url} leaves outbound
 * push sending disabled so local runs and tests start without reaching Expo.
 */
@ConfigurationProperties("app.push")
record PushProperties(
        String url,
        String accessToken,
        Duration connectTimeout,
        Duration readTimeout) {

    private static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration DEFAULT_READ_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration MAX_TIMEOUT = Duration.ofSeconds(60);

    PushProperties {
        url = normalizeUrl(url);
        accessToken = normalizeToken(accessToken);
        connectTimeout = validateTimeout(
                "app.push.connect-timeout", connectTimeout, DEFAULT_CONNECT_TIMEOUT);
        readTimeout = validateTimeout(
                "app.push.read-timeout", readTimeout, DEFAULT_READ_TIMEOUT);
    }

    boolean configured() {
        return !url.isEmpty();
    }

    @Override
    public String toString() {
        String maskedToken = accessToken.isEmpty() ? "<empty>" : "***";
        return "PushProperties[url=" + url
                + ", accessToken=" + maskedToken
                + ", connectTimeout=" + connectTimeout
                + ", readTimeout=" + readTimeout + "]";
    }

    private static String normalizeUrl(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        URI uri;
        try {
            uri = URI.create(value);
        } catch (IllegalArgumentException e) {
            throw invalidUrl();
        }
        if (!"https".equals(uri.getScheme())
                || uri.getHost() == null
                || uri.getHost().isEmpty()
                || uri.getRawQuery() != null
                || uri.getRawFragment() != null
                || uri.getUserInfo() != null) {
            throw invalidUrl();
        }
        return value;
    }

    private static IllegalArgumentException invalidUrl() {
        return new IllegalArgumentException(
                "app.push.url must be an https URL without query");
    }

    private static String normalizeToken(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        if (value.isBlank()) {
            throw new IllegalArgumentException(
                    "app.push.access-token must not be blank");
        }
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c < 0x21 || c > 0x7E) {
                throw new IllegalArgumentException(
                        "app.push.access-token must not contain whitespace or control characters");
            }
        }
        return value;
    }

    private static Duration validateTimeout(String property, Duration value, Duration defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value.isZero() || value.isNegative() || value.compareTo(MAX_TIMEOUT) > 0) {
            throw new IllegalArgumentException(
                    property + " must be greater than 0s and at most 60s");
        }
        return value;
    }
}
