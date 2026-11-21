package com.massagedesk.api.messaging;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.http.MediaType.APPLICATION_JSON;
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
        "app.whatsapp.app-secret="
})
class WhatsAppWebhookNoSecretTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StaffProfileRepository staffProfiles;

    @MockitoBean
    private WebhookDeliveries deliveries;

    @Test
    void refusesEveryPostWhenAppSecretIsEmpty() throws Exception {
        byte[] bytes = "{\"object\":\"whatsapp_business_account\"}".getBytes(StandardCharsets.UTF_8);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", signWithEmptyKey(bytes))
                        .content(bytes))
                .andExpect(status().isForbidden())
                .andExpect(content().string(""));

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .content(bytes))
                .andExpect(status().isForbidden())
                .andExpect(content().string(""));

        verify(deliveries, times(2)).reject(Rejection.APP_SECRET_NOT_SET);
        verify(deliveries, never()).accept(any());
    }

    private static String signWithEmptyKey(byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(new byte[64], "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
    }
}
