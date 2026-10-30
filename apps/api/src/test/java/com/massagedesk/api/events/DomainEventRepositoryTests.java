package com.massagedesk.api.events;

import static org.assertj.core.api.Assertions.assertThat;

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
class DomainEventRepositoryTests {

    @Autowired
    private DomainEventRepository events;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void savesAndReadsEventBack() {
        UUID entityId = UUID.randomUUID();
        DomainEvent saved = events.saveAndFlush(
                new DomainEvent(DomainEventType.APPOINTMENT_CREATED, entityId, EventActor.BOT, "{\"source\":\"bot\"}"));
        entityManager.clear();

        DomainEvent found = events.findById(saved.getId()).orElseThrow();

        assertThat(found.getType()).isEqualTo(DomainEventType.APPOINTMENT_CREATED);
        assertThat(found.getEntityType()).isEqualTo("appointment");
        assertThat(found.getEntityId()).isEqualTo(entityId);
        assertThat(found.getActor()).isEqualTo(EventActor.BOT);
        assertThat(found.getCreatedAt()).isNotNull();

        Map<String, Object> row = jdbc.queryForMap(
                "select type, entity_type, actor, payload->>'source' as source, jsonb_typeof(payload) as kind"
                        + " from events where id = ?", saved.getId());
        assertThat(row).containsEntry("type", "appointment_created")
                .containsEntry("entity_type", "appointment")
                .containsEntry("actor", "bot")
                .containsEntry("source", "bot")
                .containsEntry("kind", "object");
    }

    @Test
    void everyTypeAndActorPassesDatabaseChecks() {
        DomainEventTypeConverter typeConverter = new DomainEventTypeConverter();
        EventActorConverter actorConverter = new EventActorConverter();
        int expected = 0;
        for (DomainEventType type : DomainEventType.values()) {
            for (EventActor actor : EventActor.values()) {
                jdbc.update("insert into events (type, entity_type, actor) values (?, ?, ?)",
                        typeConverter.convertToDatabaseColumn(type), type.entityType(),
                        actorConverter.convertToDatabaseColumn(actor));
                expected++;
            }
        }

        Integer count = jdbc.queryForObject("select count(*) from events", Integer.class);

        assertThat(count).isEqualTo(expected);
    }
}
