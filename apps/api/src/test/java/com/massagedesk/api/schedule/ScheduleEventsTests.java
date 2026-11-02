package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.schedule.WorkingHoursService.Block;
import com.massagedesk.api.security.StaffRole;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class ScheduleEventsTests {

    private static final Instant TUE_START = Instant.parse("2026-11-02T19:00:00Z");
    private static final Instant TUE_END = Instant.parse("2026-11-03T19:00:00Z");

    @Autowired
    private WorkingHoursService hours;

    @Autowired
    private TimeOffService timeOff;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @BeforeEach
    void clean() {
        jdbc.update("delete from working_hours");
        jdbc.update("delete from time_off");
        jdbc.update("delete from events where type in ('working_hours_replaced', 'time_off_created', 'time_off_deleted')");
    }

    private static Block block(DayOfWeek day, String start, String end) {
        return new Block(day, LocalTime.parse(start), LocalTime.parse(end));
    }

    private List<Map<String, Object>> events(String type) {
        entityManager.flush();
        return jdbc.queryForList("select actor, entity_id, payload::text as payload from events where type = ?", type);
    }

    private boolean sameJson(Map<String, Object> event, String expected) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "select ?::jsonb = ?::jsonb", Boolean.class, event.get("payload"), expected));
    }

    private UUID tuesdayAppointment(String phone) {
        Client client = clients.saveAndFlush(new Client(phone, "Events client"));
        MassageService massage = services.saveAndFlush(
                new MassageService("Events service " + phone, 60, new BigDecimal("1000.00"), 902));
        return jdbc.queryForObject("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange('2026-11-03 14:00+05'::timestamptz, '2026-11-03 15:00+05'::timestamptz),
                        'confirmed')
                returning id
                """, UUID.class, client.getId(), massage.getId());
    }

    @Test
    void replacingTheWeekWritesOneEventWithBothWeeks() {
        hours.replaceWeek(List.of(block(DayOfWeek.MONDAY, "09:00", "13:00")), false, EventActor.MASTER);
        hours.replaceWeek(List.of(
                block(DayOfWeek.TUESDAY, "14:00", "18:00"), block(DayOfWeek.TUESDAY, "09:00", "12:00")),
                false, EventActor.MASTER);

        List<Map<String, Object>> found = events("working_hours_replaced");
        assertThat(found).hasSize(2);
        Map<String, Object> second = found.stream()
                .filter(e -> ((String) e.get("payload")).contains("\"weekday\": 2")).findFirst().orElseThrow();
        assertThat(second.get("entity_id")).isNull();
        assertThat(second).containsEntry("actor", "master");
        assertThat(sameJson(second, """
                {"from":[{"weekday":1,"start":"09:00","end":"13:00"}],
                 "to":[{"weekday":2,"start":"09:00","end":"12:00"},{"weekday":2,"start":"14:00","end":"18:00"}],
                 "forced":false,"conflict_ids":[]}
                """)).isTrue();
    }

    @Test
    void sameWeekAgainWritesNoEvent() {
        hours.replaceWeek(List.of(block(DayOfWeek.MONDAY, "09:00", "13:00")), false, EventActor.MASTER);
        hours.replaceWeek(List.of(block(DayOfWeek.MONDAY, "09:00", "13:00")), false, EventActor.MASTER);

        assertThat(events("working_hours_replaced")).hasSize(1);
    }

    @Test
    void forcedReplaceOverAnAppointmentRecordsIt() {
        UUID id = tuesdayAppointment("+998900000872");
        hours.replaceWeek(List.of(block(DayOfWeek.TUESDAY, "10:00", "16:00")), false, EventActor.MASTER);

        hours.replaceWeek(List.of(block(DayOfWeek.TUESDAY, "10:00", "13:00")), true, EventActor.MASTER);

        Map<String, Object> forced = events("working_hours_replaced").stream()
                .filter(e -> ((String) e.get("payload")).contains("\"forced\": true")).findFirst().orElseThrow();
        assertThat(sameJson(forced, """
                {"from":[{"weekday":2,"start":"10:00","end":"16:00"}],
                 "to":[{"weekday":2,"start":"10:00","end":"13:00"}],
                 "forced":true,"conflict_ids":["%s"]}
                """.formatted(id))).isTrue();
    }

    @Test
    void refusedReplaceWritesNoEvent() {
        tuesdayAppointment("+998900000873");
        hours.replaceWeek(List.of(block(DayOfWeek.TUESDAY, "10:00", "16:00")), false, EventActor.MASTER);

        assertThatThrownBy(() -> hours.replaceWeek(
                List.of(block(DayOfWeek.TUESDAY, "10:00", "13:00")), false, EventActor.MASTER))
                .isInstanceOf(ScheduleException.class);

        assertThat(events("working_hours_replaced")).hasSize(1);
    }

    @Test
    void creatingTimeOffWritesAnEventWithoutTheReason() {
        UUID id = timeOff.create(TUE_START, TUE_END, "Private trip", false, EventActor.MASTER).id();

        List<Map<String, Object>> found = events("time_off_created");
        assertThat(found).hasSize(1);
        assertThat(found.get(0).get("entity_id")).hasToString(id.toString());
        assertThat(sameJson(found.get(0), """
                {"start":"2026-11-02T19:00:00Z","end":"2026-11-03T19:00:00Z","forced":false,"conflict_ids":[]}
                """)).isTrue();
        assertThat((String) found.get(0).get("payload")).doesNotContain("Private");
    }

    @Test
    void forcedTimeOffOverAnAppointmentRecordsIt() {
        UUID appointment = tuesdayAppointment("+998900000874");

        timeOff.create(TUE_START, TUE_END, null, true, EventActor.MASTER);

        assertThat(sameJson(events("time_off_created").get(0), """
                {"start":"2026-11-02T19:00:00Z","end":"2026-11-03T19:00:00Z","forced":true,"conflict_ids":["%s"]}
                """.formatted(appointment))).isTrue();
    }

    @Test
    void refusedTimeOffWritesNoEvent() {
        tuesdayAppointment("+998900000875");

        assertThatThrownBy(() -> timeOff.create(TUE_START, TUE_END, null, false, EventActor.MASTER))
                .isInstanceOf(ScheduleException.class);

        assertThat(events("time_off_created")).isEmpty();
    }

    @Test
    void deletingTimeOffWritesAnEventAndUnknownIdWritesNone() {
        UUID id = timeOff.create(TUE_START, TUE_END, null, false, EventActor.MASTER).id();

        timeOff.delete(id, EventActor.ADMIN);
        assertThatThrownBy(() -> timeOff.delete(UUID.randomUUID(), EventActor.ADMIN))
                .isInstanceOf(ScheduleException.class);

        List<Map<String, Object>> found = events("time_off_deleted");
        assertThat(found).hasSize(1);
        assertThat(found.get(0)).containsEntry("actor", "admin");
        assertThat(found.get(0).get("entity_id")).hasToString(id.toString());
        assertThat(sameJson(found.get(0), """
                {"start":"2026-11-02T19:00:00Z","end":"2026-11-03T19:00:00Z"}
                """)).isTrue();
    }

    @Test
    void anAdminTokenIsRecordedAsAdmin() throws Exception {
        mvc.perform(post("/time-off").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"start\":\"2026-11-03T00:00:00+05:00\",\"end\":\"2026-11-04T00:00:00+05:00\"}")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.ADMIN.authority()))))
                .andExpect(status().isCreated());

        assertThat(events("time_off_created")).singleElement().satisfies(e -> assertThat(e).containsEntry("actor", "admin"));
    }
}
