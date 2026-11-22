package com.massagedesk.api.messaging;

import java.net.URI;
import java.time.Duration;
import java.util.regex.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * WhatsApp Cloud API settings from {@code application.yml}.
 *
 * <p>Any empty string among {@code url}, {@code accessToken}, or {@code phoneNumberId} leaves
 * outbound sending disabled so local runs and tests start without credentials.
 */
@ConfigurationProperties("app.whatsapp.api")
record WhatsAppApiProperties(
        String url,
        String accessToken,
        String phoneNumberId,
        Duration connectTimeout,
        Duration readTimeout) {

    private static final Pattern PHONE_NUMBER_ID = Pattern.compile("^[0-9]{1,32}$");
    private static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration DEFAULT_READ_TIMEOUT = Duration.ofSeconds(15);
    private static final Duration MAX_TIMEOUT = Duration.ofSeconds(60);

    WhatsAppApiProperties {
        url = normalizeUrl(url);
        accessToken = normalizeToken(accessToken);
        phoneNumberId = normalizePhoneNumberId(phoneNumberId);
        connectTimeout = validateTimeout(
                "app.whatsapp.api.connect-timeout", connectTimeout, DEFAULT_CONNECT_TIMEOUT);
        readTimeout = validateTimeout(
                "app.whatsapp.api.read-timeout", readTimeout, DEFAULT_READ_TIMEOUT);
    }

    boolean configured() {
        return !url.isEmpty() && !accessToken.isEmpty() && !phoneNumberId.isEmpty();
    }

    @Override
    public String toString() {
        String maskedToken = accessToken.isEmpty() ? "<empty>" : "***";
        return "WhatsAppApiProperties[url=" + url
                + ", accessToken=" + maskedToken
                + ", phoneNumberId=" + phoneNumberId
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
        String normalized = value;
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private static IllegalArgumentException invalidUrl() {
        return new IllegalArgumentException(
                "app.whatsapp.api.url must be an https URL without query");
    }

    private static String normalizeToken(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        if (value.isBlank()) {
            throw new IllegalArgumentException(
                    "app.whatsapp.api.access-token must not be blank");
        }
        return value;
    }

    private static String normalizePhoneNumberId(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        if (!PHONE_NUMBER_ID.matcher(value).matches()) {
            throw new IllegalArgumentException(
                    "app.whatsapp.api.phone-number-id must be 1..32 digits");
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
