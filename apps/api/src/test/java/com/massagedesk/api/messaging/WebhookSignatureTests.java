package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Locale;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class WebhookSignatureTests {

    // RFC 4231 test case 2
    private static final String RFC_SECRET = "Jefe";
    private static final byte[] RFC_BODY =
            "what do ya want for nothing?".getBytes(StandardCharsets.UTF_8);
    private static final String RFC_HEX =
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843";
    private static final String RFC_HEADER = "sha256=" + RFC_HEX;

    @Test
    void matchesValidRfc4231SignatureInLowerAndUpperCase() {
        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, RFC_HEADER)).isTrue();
        assertThat(WebhookSignature.matches(
                        RFC_SECRET, RFC_BODY, "sha256=" + RFC_HEX.toUpperCase(Locale.ROOT)))
                .isTrue();
    }

    @Test
    void rejectsModifiedBodyOrDifferentKey() {
        byte[] tampered = RFC_BODY.clone();
        tampered[0] ^= 0x01;

        assertThat(WebhookSignature.matches(RFC_SECRET, tampered, RFC_HEADER)).isFalse();
        assertThat(WebhookSignature.matches("other-secret", RFC_BODY, RFC_HEADER)).isFalse();
    }

    @Test
    void rejectsMalformedOrMissingHeader() {
        String shorterByOneChar = "sha256=" + RFC_HEX.substring(0, RFC_HEX.length() - 1);
        String longerByOneChar = RFC_HEADER + "0";
        String shorterByOneByte = "sha256=" + RFC_HEX.substring(0, RFC_HEX.length() - 2);
        String longerByOneByte = RFC_HEADER + "00";
        String nonHex = "sha256=g" + RFC_HEX.substring(1);
        String trailingSpace = RFC_HEADER + " ";

        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, null)).isFalse();
        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, "")).isFalse();
        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, RFC_HEX)).isFalse();
        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, "sha1=" + RFC_HEX)).isFalse();
        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, shorterByOneChar)).isFalse();
        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, longerByOneChar)).isFalse();
        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, shorterByOneByte)).isFalse();
        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, longerByOneByte)).isFalse();
        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, nonHex)).isFalse();
        assertThat(WebhookSignature.matches(RFC_SECRET, RFC_BODY, trailingSpace)).isFalse();
    }

    @Test
    void rejectsBlankSecretEvenWhenMacMatches() throws Exception {
        // In HMAC-SHA256 (block size 64), an empty key is zero-padded to 64 zero bytes.
        String emptyKeyHeader = sign(new byte[64], RFC_BODY);
        String whitespaceKeyHeader = sign("  ".getBytes(StandardCharsets.UTF_8), RFC_BODY);

        assertThat(WebhookSignature.matches(null, RFC_BODY, emptyKeyHeader)).isFalse();
        assertThat(WebhookSignature.matches("", RFC_BODY, emptyKeyHeader)).isFalse();
        assertThat(WebhookSignature.matches("  ", RFC_BODY, whitespaceKeyHeader)).isFalse();
        assertThat(WebhookSignature.matches("  ", RFC_BODY, emptyKeyHeader)).isFalse();
    }

    @Test
    void matchesEmptyBodyWithValidSignature() throws Exception {
        byte[] emptyBody = new byte[0];
        String header = sign(RFC_SECRET.getBytes(StandardCharsets.UTF_8), emptyBody);

        assertThat(WebhookSignature.matches(RFC_SECRET, emptyBody, header)).isTrue();
    }

    private static String sign(byte[] key, byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
    }
}
