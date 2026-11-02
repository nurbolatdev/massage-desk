package com.massagedesk.api.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import jakarta.persistence.EntityManager;
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
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class SettingsEventsTests {

    @Autowired
    private SettingsService service;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EntityManager entityManager;

    @BeforeEach
    void clean() {
        jdbc.update("delete from events where type = 'settings_changed'");
    }

    private List<Map<String, Object>> events() {
        entityManager.flush();
        return jdbc.queryForList(
                "select actor, entity_id, payload::text as payload from events where type = 'settings_changed'");
    }

    private boolean sameJson(Map<String, Object> event, String expected) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "select ?::jsonb = ?::jsonb", Boolean.class, event.get("payload"), expected));
    }

    @Test
    void zoneChangeWritesFromAndTo() {
        service.update("America/New_York", null, null, EventActor.ADMIN);

        List<Map<String, Object>> found = events();
        assertThat(found).hasSize(1);
        assertThat(found.get(0)).containsEntry("actor", "admin");
        assertThat(found.get(0).get("entity_id")).isNull();
        assertThat(sameJson(found.get(0), """
                {"changed":["time_zone"],"from":{"time_zone":"Asia/Tashkent"},"to":{"time_zone":"America/New_York"}}
                """)).isTrue();
    }

    @Test
    void addressChangeIsNamedButNotCopied() {
        service.update(null, "12 Secret Street", null, EventActor.MASTER);

        List<Map<String, Object>> found = events();
        assertThat(found).hasSize(1);
        assertThat(sameJson(found.get(0), "{\"changed\":[\"address\"],\"from\":{},\"to\":{}}")).isTrue();
        assertThat((String) found.get(0).get("payload")).doesNotContain("Secret");
    }

    @Test
    void botSwitchWritesBooleans() {
        service.update(null, null, false, EventActor.MASTER);

        assertThat(sameJson(events().get(0), """
                {"changed":["bot_enabled"],"from":{"bot_enabled":true},"to":{"bot_enabled":false}}
                """)).isTrue();
    }

    @Test
    void emptyAndSameValuesWriteNoEvent() {
        service.update(null, null, null, EventActor.MASTER);
        service.update("Asia/Tashkent", null, true, EventActor.MASTER);

        assertThat(events()).isEmpty();
    }

    @Test
    void unknownTimeZoneWritesNoEvent() {
        assertThatThrownBy(() -> service.update("Mars/Base", null, null, EventActor.MASTER))
                .isInstanceOf(SettingsException.class);

        assertThat(events()).isEmpty();
    }
}
