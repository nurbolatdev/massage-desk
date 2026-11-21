package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.messaging.WebhookDeliveries.Rejection;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class WebhookDeliveriesTests {

    private static final String SELECT_ROWS = """
            select signature_valid,
                   status,
                   error,
                   payload->>'object' as payload_object,
                   payload is null as payload_null,
                   created_at is not null as has_created_at,
                   processed_at is null as processed_at_null
            from webhook_logs
            order by created_at, id
            """;

    @Autowired
    private WebhookDeliveries deliveries;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clearWebhookLogs() {
        jdbc.update("delete from webhook_logs");
    }

    @Test
    void acceptStoresTheSignedPayload() {
        byte[] body = "{\"object\":\"whatsapp_business_account\",\"entry\":[]}"
                .getBytes(StandardCharsets.UTF_8);

        deliveries.accept(body);
        entityManager.flush();

        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_ROWS);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst())
                .containsEntry("signature_valid", true)
                .containsEntry("status", "received")
                .containsEntry("error", null)
                .containsEntry("payload_object", "whatsapp_business_account")
                .containsEntry("payload_null", false)
                .containsEntry("has_created_at", true)
                .containsEntry("processed_at_null", true);
    }

    @Test
    void acceptOfNonJsonIsFailed() {
        deliveries.accept("not json".getBytes(StandardCharsets.UTF_8));
        deliveries.accept("[]".getBytes(StandardCharsets.UTF_8));
        deliveries.accept(new byte[0]);
        entityManager.flush();

        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_ROWS);
        assertThat(rows).hasSize(3).allSatisfy(row -> assertThat(row)
                .containsEntry("signature_valid", true)
                .containsEntry("status", "failed")
                .containsEntry("error", "invalid_json")
                .containsEntry("payload_null", true)
                .containsEntry("has_created_at", true)
                .containsEntry("processed_at_null", true));
    }

    @Test
    void acceptOfNulCharacterIsFailed() {
        byte[] body = "{\"text\":\"a\\u0000b\"}".getBytes(StandardCharsets.UTF_8);

        deliveries.accept(body);
        entityManager.flush();

        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_ROWS);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst())
                .containsEntry("signature_valid", true)
                .containsEntry("status", "failed")
                .containsEntry("error", "nul_character")
                .containsEntry("payload_null", true)
                .containsEntry("has_created_at", true)
                .containsEntry("processed_at_null", true);
    }

    @Test
    void rejectStoresNoPayload() {
        for (Rejection reason : Rejection.values()) {
            deliveries.reject(reason);
        }
        entityManager.flush();

        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_ROWS);
        assertThat(rows).hasSize(4);
        assertThat(rows).allSatisfy(row -> assertThat(row)
                .containsEntry("signature_valid", false)
                .containsEntry("status", "rejected")
                .containsEntry("payload_null", true)
                .containsEntry("has_created_at", true)
                .containsEntry("processed_at_null", true));
        assertThat(rows)
                .extracting(row -> row.get("error"))
                .containsExactlyInAnyOrder(
                        "app_secret_not_set",
                        "missing_signature",
                        "invalid_signature",
                        "body_too_large");
    }

    @Test
    void statusConverterRoundTripsEveryValue() {
        WebhookStatusConverter converter = new WebhookStatusConverter();

        for (WebhookStatus value : WebhookStatus.values()) {
            String column = converter.convertToDatabaseColumn(value);
            assertThat(column).isEqualTo(value.name().toLowerCase());
            assertThat(converter.convertToEntityAttribute(column)).isEqualTo(value);
        }
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
        assertThat(converter.convertToEntityAttribute(null)).isNull();
        assertThatThrownBy(() -> converter.convertToEntityAttribute("unknown"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
