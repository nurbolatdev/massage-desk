package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.massagedesk.api.messaging.WebhookDeliveries.Rejection;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

/**
 * Calls the handler directly so the body stream can fail if touched.
 */
class WhatsAppWebhookBodyLimitTests {

    private static final String APP_SECRET = "test-app-secret";

    private final WebhookDeliveries deliveries = mock(WebhookDeliveries.class);
    private final WhatsAppWebhookController controller =
            new WhatsAppWebhookController("secret", APP_SECRET, deliveries);

    @Test
    void signedOversizedBodyIsRefusedUnread() throws Exception {
        byte[] oversized = new byte[WhatsAppWebhookController.MAX_BODY_BYTES + 1];

        ResponseEntity<Void> response = controller.receive(sign(oversized), request(), trap());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONTENT_TOO_LARGE);
        assertThat(response.getBody()).isNull();
        verify(deliveries).reject(Rejection.BODY_TOO_LARGE);
        verifyNoMoreInteractions(deliveries);
    }

    @Test
    void unsignedOversizedBodyIsRefusedUnread() throws Exception {
        ResponseEntity<Void> response = controller.receive(null, request(), trap());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONTENT_TOO_LARGE);
        assertThat(response.getBody()).isNull();
        verify(deliveries).reject(Rejection.BODY_TOO_LARGE);
        verifyNoMoreInteractions(deliveries);
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/webhook/whatsapp");
        request.setContent(new byte[WhatsAppWebhookController.MAX_BODY_BYTES + 1]);
        return request;
    }

    private static InputStream trap() {
        return new InputStream() {
            @Override
            public int read() {
                throw new AssertionError("body must not be read");
            }

            @Override
            public int read(byte[] b, int off, int len) {
                throw new AssertionError("body must not be read");
            }
        };
    }

    private static String sign(byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(APP_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
    }
}
