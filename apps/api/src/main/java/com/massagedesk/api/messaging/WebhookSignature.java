package com.massagedesk.api.messaging;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.jspecify.annotations.Nullable;

/**
 * Meta signs each webhook POST with HMAC-SHA256 of the raw body keyed by the app secret,
 * sent in header {@code X-Hub-Signature-256: sha256=<hex>}.
 * Digest comparison runs in constant time; a blank secret never matches.
 */
final class WebhookSignature {

    static final String PREFIX = "sha256=";
    private static final String ALGORITHM = "HmacSHA256";
    private static final int DIGEST_BYTES = 32;

    private WebhookSignature() {
    }

    static boolean matches(String appSecret, byte[] body, @Nullable String header) {
        if (appSecret == null || appSecret.isBlank() || header == null || !header.startsWith(PREFIX)) {
            return false;
        }
        byte[] actual;
        try {
            actual = HexFormat.of().parseHex(header.substring(PREFIX.length()));
        } catch (IllegalArgumentException e) {
            return false;
        }
        if (actual.length != DIGEST_BYTES) {
            return false;
        }
        byte[] expected = hmacSha256(appSecret, body);
        return MessageDigest.isEqual(expected, actual);
    }

    private static byte[] hmacSha256(String appSecret, byte[] body) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), ALGORITHM));
            return mac.doFinal(body);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(ALGORITHM + " not available", e);
        }
    }
}
