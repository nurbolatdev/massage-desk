package com.massagedesk.api.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.ScheduleException;
import com.massagedesk.api.schedule.WorkingHours;
import com.massagedesk.api.schedule.WorkingHoursRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    @BeforeEach
    void clean() {
        jdbc.update("delete from events where type = 'settings_changed'");
        jdbc.update("delete from working_hours");
    }

    private UUID tuesdayAppointment(String phone) {
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)));
        Client client = clients.saveAndFlush(new Client(phone, "Event client"));
        MassageService service = services.saveAndFlush(
                new MassageService("Event conflict service", 60, new BigDecimal("1000.00"), 1));
        return jdbc.queryForObject("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange(cast('2026-11-03 14:00+05' as timestamptz),
                                        cast('2026-11-03 15:00+05' as timestamptz)), 'confirmed')
                returning id
                """, UUID.class, client.getId(), service.getId());
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
        service.update("America/New_York", null, null, false, EventActor.ADMIN);

        List<Map<String, Object>> found = events();
        assertThat(found).hasSize(1);
        assertThat(found.get(0)).containsEntry("actor", "admin");
        assertThat(found.get(0).get("entity_id")).isNull();
        assertThat(sameJson(found.get(0), """
                {"changed":["time_zone"],"from":{"time_zone":"Asia/Tashkent"},"to":{"time_zone":"America/New_York"},"forced":false,"conflict_ids":[]}
                """)).isTrue();
    }

    @Test
    void addressChangeIsNamedButNotCopied() {
        service.update(null, "12 Secret Street", null, false, EventActor.MASTER);

        List<Map<String, Object>> found = events();
        assertThat(found).hasSize(1);
        assertThat(sameJson(found.get(0), "{\"changed\":[\"address\"],\"from\":{},\"to\":{},\"forced\":false,\"conflict_ids\":[]}")).isTrue();
        assertThat((String) found.get(0).get("payload")).doesNotContain("Secret");
    }

    @Test
    void botSwitchWritesBooleans() {
        service.update(null, null, false, false, EventActor.MASTER);

        assertThat(sameJson(events().get(0), """
                {"changed":["bot_enabled"],"from":{"bot_enabled":true},"to":{"bot_enabled":false},"forced":false,"conflict_ids":[]}
                """)).isTrue();
    }

    @Test
    void emptyAndSameValuesWriteNoEvent() {
        service.update(null, null, null, false, EventActor.MASTER);
        service.update("Asia/Tashkent", null, true, false, EventActor.MASTER);

        assertThat(events()).isEmpty();
    }

    @Test
    void unknownTimeZoneWritesNoEvent() {
        assertThatThrownBy(() -> service.update("Mars/Base", null, null, false, EventActor.MASTER))
                .isInstanceOf(SettingsException.class);

        assertThat(events()).isEmpty();
    }

    @Test
    void aForcedZoneChangeRecordsTheConflicts() {
        UUID id = tuesdayAppointment("+998900000886");

        service.update("America/New_York", null, null, true, EventActor.MASTER);

        List<Map<String, Object>> found = events();
        assertThat(found).hasSize(1);
        assertThat(sameJson(found.get(0), """
                {"changed":["time_zone"],"from":{"time_zone":"Asia/Tashkent"},
                 "to":{"time_zone":"America/New_York"},"forced":true,"conflict_ids":["%s"]}
                """.formatted(id))).isTrue();
    }

    @Test
    void aRefusedZoneChangeWritesNoEvent() {
        tuesdayAppointment("+998900000887");

        assertThatThrownBy(() -> service.update("America/New_York", null, null, false, EventActor.MASTER))
                .isInstanceOf(ScheduleException.class);

        assertThat(events()).isEmpty();
    }

    @Test
    void forceWithAnAddressOnlyChangeRecordsNoConflicts() {
        service.update(null, "Navoi 12", null, true, EventActor.MASTER);

        assertThat(sameJson(events().get(0), """
                {"changed":["address"],"from":{},"to":{},"forced":true,"conflict_ids":[]}
                """)).isTrue();
    }

    @Test
    void forceWithTheSameValuesWritesNoEvent() {
        service.update("Asia/Tashkent", null, true, true, EventActor.MASTER);

        assertThat(events()).isEmpty();
    }
}
