package com.massagedesk.api.clients;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
class ClientFindOrCreateTests {

    @Autowired
    private ClientService service;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    private List<Map<String, Object>> createdEvents(UUID id) {
        entityManager.flush();
        return jdbc.queryForList(
                "select actor, payload::text as payload from events where entity_id = ? and type = 'client_created'",
                id);
    }

    private Map<String, Object> clientRow(UUID id) {
        return jdbc.queryForMap("select phone, name from clients where id = ?", id);
    }

    @Test
    void newPhoneCreatesClientAndEvent() {
        UUID id = service.findOrCreate("+998900000971", "  Aziza  ", EventActor.CLIENT);

        assertThat(clientRow(id))
                .containsEntry("phone", "+998900000971")
                .containsEntry("name", "Aziza");
        List<Map<String, Object>> events = createdEvents(id);
        assertThat(events).hasSize(1);
        assertThat(events.get(0)).containsEntry("actor", "client");
        assertThat(jdbc.queryForObject(
                "select ?::jsonb = '{}'::jsonb",
                Boolean.class,
                events.get(0).get("payload"))).isTrue();
    }

    @Test
    void existingPhoneKeepsNameAndWritesNoSecondEvent() {
        UUID first = service.findOrCreate("+998900000972", "Aziza", EventActor.CLIENT);
        UUID second = service.findOrCreate("+998900000972", "Other Name", EventActor.CLIENT);

        assertThat(second).isEqualTo(first);
        assertThat(clientRow(first)).containsEntry("name", "Aziza");
        assertThat(createdEvents(first)).hasSize(1);
    }

    @Test
    void clientCreatedByMasterIsFoundWithoutOverwritingNameOrEvent() {
        UUID created = service.create("+998900000973", "Master Name", "Notes", EventActor.MASTER).id();

        UUID found = service.findOrCreate("+998900000973", "Profile Name", EventActor.CLIENT);

        assertThat(found).isEqualTo(created);
        assertThat(clientRow(created)).containsEntry("name", "Master Name");
        List<Map<String, Object>> events = createdEvents(created);
        assertThat(events).hasSize(1);
        assertThat(events.get(0)).containsEntry("actor", "master");
    }

    @Test
    void nullOrBlankNameIsStoredAsNull() {
        UUID withNull = service.findOrCreate("+998900000974", null, EventActor.CLIENT);
        UUID withBlank = service.findOrCreate("+998900000975", "   ", EventActor.CLIENT);

        assertThat(clientRow(withNull).get("name")).isNull();
        assertThat(clientRow(withBlank).get("name")).isNull();
    }

    @Test
    void nonE164PhonesAreRefused() {
        long before = jdbc.queryForObject("select count(*) from clients", Long.class);

        assertThatThrownBy(() -> service.findOrCreate("998901234567", "Aziza", EventActor.CLIENT))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("phone must be E.164");
        assertThatThrownBy(() -> service.findOrCreate("abc", "Aziza", EventActor.CLIENT))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("phone must be E.164");

        long after = jdbc.queryForObject("select count(*) from clients", Long.class);
        assertThat(after).isEqualTo(before);
    }
}
