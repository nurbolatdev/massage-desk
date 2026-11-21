package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;

import com.massagedesk.api.TestcontainersConfiguration;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * A delivery whose processing fails halfway leaves no client, message or event behind and is
 * logged as failed. Deliberately not {@code @Transactional}: a test-managed transaction would
 * hide whether the store itself rolls back. Rows belong to a dedicated phone and webhook entry
 * id and are deleted in {@link #cleanUp()}.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AtomicDeliveryTests {

    private static final String WA_ID = "998900000808";
    private static final String PHONE = "+998900000808";
    private static final String ENTRY_FILTER = "{\"entry\":[{\"id\":\"atomic-delivery-test\"}]}";

    @Autowired
    private WebhookDeliveries deliveries;

    @Autowired
    private JdbcTemplate jdbc;

    @MockitoSpyBean
    private ConversationStore conversations;

    @BeforeEach
    @AfterEach
    void cleanUp() {
        jdbc.update("""
                delete from messages
                where conversation_id in (
                    select id from conversations
                    where client_id in (select id from clients where phone = ?)
                )
                """, PHONE);
        jdbc.update("""
                delete from conversations
                where client_id in (select id from clients where phone = ?)
                """, PHONE);
        jdbc.update("""
                delete from events
                where type = 'client_created'
                  and entity_id in (select id from clients where phone = ?)
                """, PHONE);
        jdbc.update("delete from clients where phone = ?", PHONE);
        jdbc.update("delete from webhook_logs where payload @> ?::jsonb", ENTRY_FILTER);
    }

    @Test
    void failureOnTheSecondMessageRollsBackTheWholeDelivery() {
        doCallRealMethod().doThrow(new UnsupportedOperationException("boom"))
                .when(conversations)
                .addInbound(any(UUID.class), anyString(), anyString(), any(Instant.class));

        deliveries.accept(delivery().getBytes(StandardCharsets.UTF_8));

        List<Map<String, Object>> logs = jdbc.queryForList("""
                select status, error, payload is not null as has_payload
                from webhook_logs where payload @> ?::jsonb
                """, ENTRY_FILTER);
        assertThat(logs).hasSize(1);
        assertThat(logs.getFirst())
                .containsEntry("status", "failed")
                .containsEntry("error", "java.lang.UnsupportedOperationException")
                .containsEntry("has_payload", true);
        assertThat(count("select count(*) from clients where phone = ?")).isZero();
        assertThat(count("""
                select count(*) from messages
                where wa_message_id in ('wamid.atomic-1', 'wamid.atomic-2')
                """)).isZero();
        assertThat(count("""
                select count(*) from events
                where type = 'client_created'
                  and entity_id in (select id from clients where phone = ?)
                """)).isZero();
    }

    private long count(String sql) {
        if (sql.contains("?")) {
            return jdbc.queryForObject(sql, Long.class, PHONE);
        }
        return jdbc.queryForObject(sql, Long.class);
    }

    private static String delivery() {
        return """
                {
                  "object": "whatsapp_business_account",
                  "entry": [
                    {
                      "id": "atomic-delivery-test",
                      "changes": [
                        {
                          "field": "messages",
                          "value": {
                            "contacts": [ { "profile": { "name": "Aziza" }, "wa_id": "%1$s" } ],
                            "messages": [
                              { "from": "%1$s", "id": "wamid.atomic-1", "timestamp": "1700000000",
                                "type": "text", "text": { "body": "One" } },
                              { "from": "%1$s", "id": "wamid.atomic-2", "timestamp": "1700000001",
                                "type": "text", "text": { "body": "Two" } }
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
                """.formatted(WA_ID);
    }
}
