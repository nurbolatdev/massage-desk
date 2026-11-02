package com.massagedesk.api.clients;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class ClientEventsTests {

    @Autowired
    private ClientService service;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    private List<Map<String, Object>> updates(UUID id) {
        entityManager.flush();
        return jdbc.queryForList(
                "select actor, payload::text as payload from events where entity_id = ? and type = 'client_updated'",
                id);
    }

    @Test
    void renameAndNotesWriteOneEventWithoutPersonalData() {
        UUID id = service.create("+998900000869", "Secret Name", "Secret notes", EventActor.MASTER).id();

        service.update(id, "Other Name", "Other notes", EventActor.ADMIN);

        List<Map<String, Object>> events = updates(id);
        assertThat(events).hasSize(1);
        assertThat(events.get(0)).containsEntry("actor", "admin");
        String payload = (String) events.get(0).get("payload");
        assertThat(jdbc.queryForObject("select ?::jsonb = '{\"changed\":[\"name\",\"notes\"],\"from\":{},\"to\":{}}'::jsonb",
                Boolean.class, payload)).isTrue();
        assertThat(payload).doesNotContain("Secret", "Other");
    }

    @Test
    void sameValuesWriteNoEvent() {
        UUID id = service.create("+998900000870", "Name", "Notes", EventActor.MASTER).id();

        service.update(id, "Name", "Notes", EventActor.MASTER);
        service.update(id, null, null, EventActor.MASTER);

        assertThat(updates(id)).isEmpty();
    }

    @Test
    void unknownClientWritesNoEvent() {
        UUID id = UUID.randomUUID();

        try {
            service.update(id, "x", null, EventActor.MASTER);
        } catch (ClientException expected) {
            assertThat(expected.reason()).isEqualTo(ClientException.Reason.CLIENT_NOT_FOUND);
        }

        assertThat(updates(id)).isEmpty();
    }

    @Test
    void clearingNotesIsAChange() {
        UUID id = service.create("+998900000871", "Name", "Notes", EventActor.MASTER).id();

        service.update(id, null, "  ", EventActor.MASTER);

        assertThat(updates(id)).hasSize(1);
    }
}
