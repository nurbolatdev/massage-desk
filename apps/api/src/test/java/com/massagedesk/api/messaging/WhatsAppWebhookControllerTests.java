package com.massagedesk.api.messaging;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.MediaType.TEXT_PLAIN;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.messaging.WebhookDeliveries.Rejection;
import com.massagedesk.api.security.SecurityConfig;
import com.massagedesk.api.security.StaffProfileRepository;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(WhatsAppWebhookController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = {
        "app.whatsapp.verify-token=secret",
        "app.whatsapp.app-secret=test-app-secret"
})
class WhatsAppWebhookControllerTests {

    private static final String APP_SECRET = "test-app-secret";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StaffProfileRepository staffProfiles;

    @MockitoBean
    private WebhookDeliveries deliveries;

    @Test
    void echoesTheChallengeForTheRightToken() throws Exception {
        mockMvc.perform(get("/webhook/whatsapp")
                        .param("hub.mode", "subscribe")
                        .param("hub.verify_token", "secret")
                        .param("hub.challenge", "1158201444"))
                .andExpect(status().isOk())
                .andExpect(content().string("1158201444"));
    }

    @Test
    void rejectsAWrongToken() throws Exception {
        mockMvc.perform(get("/webhook/whatsapp")
                        .param("hub.mode", "subscribe")
                        .param("hub.verify_token", "nope")
                        .param("hub.challenge", "42"))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsAWrongModeOrMissingParameters() throws Exception {
        mockMvc.perform(get("/webhook/whatsapp")
                        .param("hub.mode", "unsubscribe")
                        .param("hub.verify_token", "secret")
                        .param("hub.challenge", "42"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/webhook/whatsapp")).andExpect(status().isForbidden());
    }

    @Test
    void acceptsASignedDelivery() throws Exception {
        byte[] bytes = "{\"object\":\"whatsapp_business_account\"}".getBytes(StandardCharsets.UTF_8);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", sign(bytes))
                        .content(bytes))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        verify(deliveries).accept(bytes);
        verify(deliveries, never()).reject(any());
    }

    @Test
    void refusesAMissingSignature() throws Exception {
        byte[] bytes = "{\"object\":\"whatsapp_business_account\"}".getBytes(StandardCharsets.UTF_8);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .content(bytes))
                .andExpect(status().isForbidden())
                .andExpect(content().string(""));

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", "   ")
                        .content(bytes))
                .andExpect(status().isForbidden())
                .andExpect(content().string(""));

        verify(deliveries, times(2)).reject(Rejection.MISSING_SIGNATURE);
        verify(deliveries, never()).accept(any());
    }

    @Test
    void refusesAWrongSignature() throws Exception {
        byte[] bytes = "{\"object\":\"whatsapp_business_account\"}".getBytes(StandardCharsets.UTF_8);
        byte[] otherBytes = "{\"object\":\"other\"}".getBytes(StandardCharsets.UTF_8);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", sign(otherBytes))
                        .content(bytes))
                .andExpect(status().isForbidden())
                .andExpect(content().string(""));

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", sign("other-secret", bytes))
                        .content(bytes))
                .andExpect(status().isForbidden())
                .andExpect(content().string(""));

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", sign(bytes).substring("sha256=".length()))
                        .content(bytes))
                .andExpect(status().isForbidden())
                .andExpect(content().string(""));

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", "sha256=not-hex")
                        .content(bytes))
                .andExpect(status().isForbidden())
                .andExpect(content().string(""));

        verify(deliveries, times(4)).reject(Rejection.INVALID_SIGNATURE);
        verify(deliveries, never()).accept(any());
    }

    @Test
    void acceptsAnyContentType() throws Exception {
        byte[] bytes = "{\"object\":\"whatsapp_business_account\"}".getBytes(StandardCharsets.UTF_8);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(TEXT_PLAIN)
                        .header("X-Hub-Signature-256", sign(bytes))
                        .content(bytes))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        verify(deliveries).accept(bytes);
    }

    @Test
    void refusesABodyOverTheLimit() throws Exception {
        byte[] overLimit = new byte[WhatsAppWebhookController.MAX_BODY_BYTES + 1];
        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", sign(overLimit))
                        .content(overLimit))
                .andExpect(status().isContentTooLarge())
                .andExpect(content().string(""));

        verify(deliveries).reject(Rejection.BODY_TOO_LARGE);
        verify(deliveries, never()).accept(any());

        byte[] atLimit = new byte[WhatsAppWebhookController.MAX_BODY_BYTES];
        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", sign(atLimit))
                        .content(atLimit))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        verify(deliveries).accept(atLimit);
    }

    @Test
    void refusesAnOversizeBodyWithoutASignature() throws Exception {
        byte[] overLimit = new byte[WhatsAppWebhookController.MAX_BODY_BYTES + 1];

        mockMvc.perform(post("/webhook/whatsapp").contentType(APPLICATION_JSON).content(overLimit))
                .andExpect(status().isContentTooLarge());

        verify(deliveries).reject(Rejection.BODY_TOO_LARGE);
        verify(deliveries, never()).accept(any());
    }

    private static String sign(byte[] body) throws Exception {
        return sign(APP_SECRET, body);
    }

    private static String sign(String secret, byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
    }
}
