package com.massagedesk.api.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.WorkingHours;
import com.massagedesk.api.schedule.WorkingHoursRepository;
import com.massagedesk.api.security.StaffRole;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalTime;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class AppointmentEventsTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    private Client client;
    private MassageService classic;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from working_hours");
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)));
        client = clients.saveAndFlush(new Client("+998900000503", "Events client"));
        classic = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
    }

    private ResultActions send(String path, String json, StaffRole role) throws Exception {
        var request = post(path).with(jwt().authorities(new SimpleGrantedAuthority(role.authority())));
        if (json != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(json);
        }
        return mvc.perform(request);
    }

    private String create(String start, StaffRole role) throws Exception {
        String json = send("/appointments", """
                {"clientId":"%s","serviceId":"%s","start":"%s"}
                """.formatted(client.getId(), classic.getId(), start), role)
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.id");
    }

    private int events(String id, String type) {
        entityManager.flush();
        return jdbc.queryForObject(
                "select count(*) from events where entity_id = ? and type = ?", Integer.class,
                UUID.fromString(id), type);
    }

    private Map<String, Object> event(String id, String type) {
        entityManager.flush();
        return jdbc.queryForMap("""
                select entity_type, actor, payload->>'client_id' as client_id,
                       payload->>'service_id' as service_id, payload->>'start' as start,
                       payload->>'end' as "end", payload->>'source' as source,
                       payload->>'previous_start' as previous_start,
                       payload->>'previous_end' as previous_end,
                       jsonb_exists(payload, 'name') as has_name, jsonb_exists(payload, 'phone') as has_phone
                from events where entity_id = ? and type = ?
                """, UUID.fromString(id), type);
    }

    @Test
    void createWritesOneEvent() throws Exception {
        String id = create("2026-11-03T10:00:00+05:00", StaffRole.MASTER);

        assertThat(events(id, "appointment_created")).isEqualTo(1);
        assertThat(event(id, "appointment_created"))
                .containsEntry("entity_type", "appointment")
                .containsEntry("actor", "master")
                .containsEntry("client_id", client.getId().toString())
                .containsEntry("service_id", classic.getId().toString())
                .containsEntry("start", "2026-11-03T05:00:00Z")
                .containsEntry("end", "2026-11-03T06:00:00Z")
                .containsEntry("source", "manual")
                .containsEntry("has_name", false)
                .containsEntry("has_phone", false);
    }

    @Test
    void adminActorIsRecorded() throws Exception {
        String id = create("2026-11-03T10:00:00+05:00", StaffRole.ADMIN);

        assertThat(event(id, "appointment_created")).containsEntry("actor", "admin");
    }

    @Test
    void rescheduleWritesOneEvent() throws Exception {
        String id = create("2026-11-03T10:00:00+05:00", StaffRole.MASTER);

        send("/appointments/" + id + "/reschedule", "{\"start\":\"2026-11-03T13:00:00+05:00\"}", StaffRole.MASTER)
                .andExpect(status().isOk());

        assertThat(events(id, "appointment_rescheduled")).isEqualTo(1);
        assertThat(event(id, "appointment_rescheduled"))
                .containsEntry("entity_type", "appointment")
                .containsEntry("actor", "master")
                .containsEntry("previous_start", "2026-11-03T05:00:00Z")
                .containsEntry("previous_end", "2026-11-03T06:00:00Z")
                .containsEntry("start", "2026-11-03T08:00:00Z")
                .containsEntry("end", "2026-11-03T09:00:00Z")
                .containsEntry("has_name", false)
                .containsEntry("has_phone", false);
    }

    @Test
    void cancelWritesOneEvent() throws Exception {
        String id = create("2026-11-03T10:00:00+05:00", StaffRole.MASTER);

        send("/appointments/" + id + "/cancel", null, StaffRole.MASTER).andExpect(status().isOk());

        assertThat(events(id, "appointment_cancelled")).isEqualTo(1);
        assertThat(event(id, "appointment_cancelled"))
                .containsEntry("actor", "master")
                .containsEntry("start", "2026-11-03T05:00:00Z")
                .containsEntry("end", "2026-11-03T06:00:00Z")
                .containsEntry("has_name", false)
                .containsEntry("has_phone", false);
    }

    @Test
    void noShowWritesOneEvent() throws Exception {
        UUID id = jdbc.queryForObject("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange('2026-11-02 09:00+05'::timestamptz, '2026-11-02 10:00+05'::timestamptz),
                        'confirmed')
                returning id
                """, UUID.class, client.getId(), classic.getId());

        send("/appointments/" + id + "/no-show", null, StaffRole.MASTER).andExpect(status().isOk());

        assertThat(events(id.toString(), "appointment_no_show")).isEqualTo(1);
        assertThat(event(id.toString(), "appointment_no_show"))
                .containsEntry("actor", "master")
                .containsEntry("start", "2026-11-02T04:00:00Z")
                .containsEntry("end", "2026-11-02T05:00:00Z");
    }

    @Test
    void refusedActionsWriteNoEvent() throws Exception {
        UUID unknown = UUID.randomUUID();
        send("/appointments/" + unknown + "/cancel", null, StaffRole.MASTER).andExpect(status().isNotFound());
        assertThat(events(unknown.toString(), "appointment_cancelled")).isZero();

        String id = create("2026-11-03T10:00:00+05:00", StaffRole.MASTER);
        send("/appointments/" + id + "/cancel", null, StaffRole.MASTER).andExpect(status().isOk());
        assertThat(events(id, "appointment_cancelled")).isEqualTo(1);

        send("/appointments/" + id + "/cancel", null, StaffRole.MASTER).andExpect(status().isConflict());
        send("/appointments/" + id + "/no-show", null, StaffRole.MASTER).andExpect(status().isConflict());
        assertThat(events(id, "appointment_cancelled")).isEqualTo(1);
        assertThat(events(id, "appointment_no_show")).isZero();
    }
}
