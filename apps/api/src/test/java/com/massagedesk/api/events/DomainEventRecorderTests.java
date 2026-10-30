package com.massagedesk.api.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import jakarta.persistence.EntityManager;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class DomainEventRecorderTests {

    @Autowired
    DomainEventRecorder recorder;

    @Autowired
    EntityManager entityManager;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void storesPayloadAsJsonObject() {
        UUID id = UUID.randomUUID();

        DomainEvent event = recorder.record(DomainEventType.CLIENT_CREATED, id, EventActor.MASTER,
                Map.of("source", "manual", "count", 2, "nested", Map.of("a", "b")));
        entityManager.flush();
        entityManager.clear();

        Map<String, Object> row = jdbc.queryForMap("""
                select payload->>'source' as source, (payload->>'count')::int as cnt,
                       payload->'nested'->>'a' as nested, entity_type, actor
                from events where id = ?""", event.getId());
        assertThat(row).containsEntry("source", "manual")
                .containsEntry("cnt", 2)
                .containsEntry("nested", "b")
                .containsEntry("entity_type", "client")
                .containsEntry("actor", "master");
    }

    @Test
    void storesEmptyPayloadAsEmptyObject() {
        DomainEvent event = recorder.record(DomainEventType.CLIENT_CREATED, UUID.randomUUID(),
                EventActor.SYSTEM, Map.of());
        entityManager.flush();

        String payload = jdbc.queryForObject("select payload::text from events where id = ?", String.class,
                event.getId());
        assertThat(payload).isEqualTo("{}");
    }

    @Test
    void rejectsNullArguments() {
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> recorder.record(null, id, EventActor.BOT, Map.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> recorder.record(DomainEventType.CLIENT_CREATED, id, null, Map.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> recorder.record(DomainEventType.CLIENT_CREATED, null, EventActor.BOT, Map.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> recorder.record(DomainEventType.CLIENT_CREATED, id, EventActor.BOT, null))
                .isInstanceOf(NullPointerException.class);
    }
}
