package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
@TestPropertySource(properties = "app.whatsapp.app-secret=test-app-secret")
class WhatsAppWebhookDeliveryTests {

    private static final String APP_SECRET = "test-app-secret";
    private static final String SELECT_ROWS = """
            select signature_valid,
                   status,
                   error,
                   payload->>'object' as payload_object,
                   payload is null as payload_null
            from webhook_logs
            order by created_at, id
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clearWebhookLogs() {
        jdbc.update("delete from webhook_logs");
    }

    @Test
    void signedDeliveryIsAcceptedAndLoggedWithPayload() throws Exception {
        byte[] body = "{\"object\":\"whatsapp_business_account\",\"entry\":[]}"
                .getBytes(StandardCharsets.UTF_8);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", sign(body))
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(content().string(""));
        entityManager.flush();

        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_ROWS);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst())
                .containsEntry("signature_valid", true)
                .containsEntry("status", "received")
                .containsEntry("error", null)
                .containsEntry("payload_object", "whatsapp_business_account")
                .containsEntry("payload_null", false);
    }

    @Test
    void unsignedDeliveryIsRefusedAndLoggedWithoutPayload() throws Exception {
        byte[] body = "{\"object\":\"whatsapp_business_account\",\"entry\":[]}"
                .getBytes(StandardCharsets.UTF_8);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(content().string(""));
        entityManager.flush();

        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_ROWS);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst())
                .containsEntry("signature_valid", false)
                .containsEntry("status", "rejected")
                .containsEntry("error", "missing_signature")
                .containsEntry("payload_null", true);
    }

    private static String sign(byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(APP_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
    }
}
