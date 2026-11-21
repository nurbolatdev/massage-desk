package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Redelivery and parallel delivery tests against the real database. Deliberately not
 * {@code @Transactional}: a test-managed transaction would serialise parallel calls on one
 * connection and hide races between transactions. Rows belong to a dedicated client phone and
 * webhook entry id and are deleted in {@link #cleanUp()}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = "app.whatsapp.app-secret=test-app-secret")
class DuplicateDeliveriesTests {

    private static final String APP_SECRET = "test-app-secret";
    private static final String WA_ID = "998900000707";
    private static final String PHONE = "+998900000707";
    private static final String ENTRY_ID = "duplicate-deliveries-test";
    private static final String ENTRY_FILTER =
            "{\"entry\":[{\"id\":\"duplicate-deliveries-test\"}]}";

    private static final String SELECT_LOG_ROWS = """
            select status,
                   error,
                   processed_at is not null as has_processed_at,
                   payload is not null as has_payload
            from webhook_logs
            where payload @> ?::jsonb
            order by created_at, id
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private WebhookDeliveries deliveries;

    @Autowired
    private JdbcTemplate jdbc;

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
    void redeliveryOverHttpIsIgnored() throws Exception {
        byte[] body = delivery("wamid.dup-1");
        String signature = sign(body);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", signature)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        OffsetDateTime firstInboundAt = lastInboundAt();
        assertThat(firstInboundAt).isNotNull();

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", signature)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        assertThat(messageCount()).isEqualTo(1);
        assertThat(clientCreatedCount()).isEqualTo(1);
        assertThat(lastInboundAt()).isEqualTo(firstInboundAt);

        List<Map<String, Object>> logs = logRows();
        assertThat(logs).hasSize(2);
        assertThat(logs.get(0))
                .containsEntry("status", "processed")
                .containsEntry("error", null)
                .containsEntry("has_processed_at", true)
                .containsEntry("has_payload", true);
        assertThat(logs.get(1))
                .containsEntry("status", "duplicate")
                .containsEntry("error", null)
                .containsEntry("has_processed_at", true)
                .containsEntry("has_payload", true);
    }

    @Test
    void deliveryWithOneNewMessageIsProcessed() throws Exception {
        byte[] first = delivery("wamid.dup-a");
        byte[] second = delivery("wamid.dup-a", "wamid.dup-b");

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", sign(first))
                        .content(first))
                .andExpect(status().isOk());

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(APPLICATION_JSON)
                        .header("X-Hub-Signature-256", sign(second))
                        .content(second))
                .andExpect(status().isOk());

        assertThat(messageCount()).isEqualTo(2);
        List<Map<String, Object>> logs = logRows();
        assertThat(logs)
                .extracting(row -> row.get("status"))
                .containsExactly("processed", "processed");
    }

    @RepeatedTest(3)
    void parallelIdenticalDeliveriesStoreOneMessage() throws Exception {
        byte[] sameBytes = delivery("wamid.dup-parallel");
        List<Callable<Void>> tasks = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            tasks.add(() -> {
                deliveries.accept(sameBytes);
                return null;
            });
        }

        runParallel(tasks);

        assertThat(clientCount()).isEqualTo(1);
        assertThat(conversationCount()).isEqualTo(1);
        assertThat(messageCount()).isEqualTo(1);
        assertThat(clientCreatedCount()).isEqualTo(1);

        List<Map<String, Object>> logs = logRows();
        assertThat(logs).hasSize(6);
        assertThat(logs).allSatisfy(row -> assertThat(row)
                .containsEntry("error", null)
                .containsEntry("has_processed_at", true)
                .containsEntry("has_payload", true));
        assertThat(logs).filteredOn(row -> "processed".equals(row.get("status"))).hasSize(1);
        assertThat(logs).filteredOn(row -> "duplicate".equals(row.get("status"))).hasSize(5);
    }

    private static byte[] delivery(String... messages) {
        List<String> items = new ArrayList<>();
        for (int i = 0; i < messages.length; i++) {
            String id = messages[i];
            long timestamp = 1700000000L + i;
            items.add("""
                    {
                      "from": "%s",
                      "id": "%s",
                      "timestamp": "%d",
                      "type": "text",
                      "text": { "body": "Message %s" }
                    }
                    """.formatted(WA_ID, id, timestamp, id));
        }
        return """
                {
                  "object": "whatsapp_business_account",
                  "entry": [
                    {
                      "id": "%s",
                      "changes": [
                        {
                          "field": "messages",
                          "value": {
                            "contacts": [
                              {
                                "profile": { "name": "Aziza" },
                                "wa_id": "%s"
                              }
                            ],
                            "messages": [%s]
                          }
                        }
                      ]
                    }
                  ]
                }
                """.formatted(ENTRY_ID, WA_ID, String.join(",", items))
                .getBytes(StandardCharsets.UTF_8);
    }

    private static String sign(byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(APP_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
    }

    private static void runParallel(List<Callable<Void>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<Void>> futures = new ArrayList<>();
            for (Callable<Void> task : tasks) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return task.call();
                }));
            }
            start.countDown();
            for (Future<Void> future : futures) {
                future.get(30, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
    }

    private List<Map<String, Object>> logRows() {
        return jdbc.queryForList(SELECT_LOG_ROWS, ENTRY_FILTER);
    }

    private int clientCount() {
        return jdbc.queryForObject(
                "select count(*) from clients where phone = ?",
                Integer.class,
                PHONE);
    }

    private int conversationCount() {
        return jdbc.queryForObject("""
                select count(*) from conversations
                where client_id in (select id from clients where phone = ?)
                """, Integer.class, PHONE);
    }

    private int messageCount() {
        return jdbc.queryForObject("""
                select count(*) from messages
                where conversation_id in (
                    select id from conversations
                    where client_id in (select id from clients where phone = ?)
                )
                """, Integer.class, PHONE);
    }

    private int clientCreatedCount() {
        return jdbc.queryForObject("""
                select count(*) from events
                where type = 'client_created'
                  and entity_id in (select id from clients where phone = ?)
                """, Integer.class, PHONE);
    }

    private OffsetDateTime lastInboundAt() {
        return jdbc.queryForObject("""
                select last_inbound_at from conversations
                where client_id in (select id from clients where phone = ?)
                """, OffsetDateTime.class, PHONE);
    }
}
