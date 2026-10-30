package com.massagedesk.api.schema;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Event log and observability tables. A failed statement aborts the PostgreSQL transaction,
 * so every rejection is its own test and the last statement in it.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class ObservabilitySchemaTests {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void timeIndexesExist() {
        List<String> indexes = jdbc.queryForList(
                "select indexname from pg_indexes where tablename in ('events', 'ai_runs', 'webhook_logs')",
                String.class);

        assertThat(indexes).contains(
                "events_created_at_idx",
                "events_type_created_at_idx",
                "events_entity_idx",
                "ai_runs_created_at_idx",
                "ai_runs_conversation_idx",
                "webhook_logs_created_at_idx",
                "webhook_logs_status_idx");
    }

    @Test
    void eventGetsDefaults() {
        Map<String, Object> row = jdbc.queryForMap(
                "insert into events (type, entity_type, actor) values ('appointment_created', 'appointment', 'bot')"
                        + " returning payload::text as payload, created_at");

        assertThat(row.get("payload")).isEqualTo("{}");
        assertThat(row.get("created_at")).isNotNull();
    }

    @Test
    void eventRejectsUnknownActor() {
        assertThatThrownBy(() -> jdbc.update(
                "insert into events (type, entity_type, actor) values ('appointment_created', 'appointment', 'robot')"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void eventRejectsMalformedType() {
        assertThatThrownBy(() -> jdbc.update(
                "insert into events (type, entity_type, actor) values ('Appointment Created', 'appointment', 'bot')"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void eventRejectsNonObjectPayload() {
        assertThatThrownBy(() -> jdbc.update(
                "insert into events (type, entity_type, actor, payload)"
                        + " values ('appointment_created', 'appointment', 'bot', '[]'::jsonb)"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void aiRunGetsEmptyToolCalls() {
        String toolCalls = jdbc.queryForObject(
                "insert into ai_runs (model, status) values ('test-model', 'ok') returning tool_calls::text",
                String.class);

        assertThat(toolCalls).isEqualTo("[]");
    }

    @Test
    void aiRunRejectsUnknownStatus() {
        assertThatThrownBy(() -> jdbc.update("insert into ai_runs (model, status) values ('test-model', 'pending')"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void aiRunRejectsNegativeTokens() {
        assertThatThrownBy(() -> jdbc.update(
                "insert into ai_runs (model, status, input_tokens) values ('test-model', 'ok', -1)"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void webhookLogStartsAsReceived() {
        String status = jdbc.queryForObject(
                "insert into webhook_logs (signature_valid, payload) values (true, '{\"a\":1}'::jsonb) returning status",
                String.class);

        assertThat(status).isEqualTo("received");
    }

    @Test
    void webhookLogRejectsUnknownStatus() {
        assertThatThrownBy(() -> jdbc.update(
                "insert into webhook_logs (signature_valid, status) values (true, 'unknown')"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
