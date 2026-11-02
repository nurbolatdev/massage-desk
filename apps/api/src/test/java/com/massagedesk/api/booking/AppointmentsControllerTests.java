package com.massagedesk.api.booking;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalTime;
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
class AppointmentsControllerTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    @Autowired
    private JdbcTemplate jdbc;

    private Client client;
    private MassageService classic;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from working_hours");
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)));
        client = clients.saveAndFlush(new Client("+998900000502", "Controller client"));
        classic = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
    }

    private String body(String start) {
        return """
                {"clientId":"%s","serviceId":"%s","start":"%s"}
                """.formatted(client.getId(), classic.getId(), start);
    }

    private ResultActions postJson(String json, StaffRole role) throws Exception {
        return mvc.perform(post("/appointments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json)
                .with(jwt().authorities(new SimpleGrantedAuthority(role.authority()))));
    }

    private ResultActions postJson(String json) throws Exception {
        return postJson(json, StaffRole.MASTER);
    }

    @Test
    void createsAppointment() throws Exception {
        postJson(body("2026-11-03T10:00:00+05:00"))
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.clientId").value(client.getId().toString()))
                .andExpect(jsonPath("$.serviceId").value(classic.getId().toString()))
                .andExpect(jsonPath("$.start").value("2026-11-03T10:00:00+05:00"))
                .andExpect(jsonPath("$.end").value("2026-11-03T11:00:00+05:00"))
                .andExpect(jsonPath("$.status").value("confirmed"))
                .andExpect(jsonPath("$.source").value("manual"));
    }

    @Test
    void acceptsStartInAnotherOffset() throws Exception {
        postJson(body("2026-11-03T05:00:00Z"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.start").value("2026-11-03T10:00:00+05:00"));
    }

    @Test
    void adminCanCreate() throws Exception {
        postJson(body("2026-11-03T10:00:00+05:00"), StaffRole.ADMIN).andExpect(status().isCreated());
    }

    @Test
    void requiresToken() throws Exception {
        mvc.perform(post("/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("2026-11-03T10:00:00+05:00")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void missingServiceIdIsBadRequest() throws Exception {
        postJson("""
                {"clientId":"%s","start":"2026-11-03T10:00:00+05:00"}
                """.formatted(client.getId()))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void startWithoutOffsetIsBadRequest() throws Exception {
        postJson(body("2026-11-03T10:00:00"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void malformedJsonIsBadRequest() throws Exception {
        postJson("{not json")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void unknownClientIsNotFound() throws Exception {
        postJson("""
                {"clientId":"%s","serviceId":"%s","start":"2026-11-03T10:00:00+05:00"}
                """.formatted(UUID.randomUUID(), classic.getId()))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("client not found"));
    }

    @Test
    void inactiveServiceIsNotFound() throws Exception {
        jdbc.update("update services set active = false where id = ?", classic.getId());

        postJson(body("2026-11-03T10:00:00+05:00"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("service not found"));
    }

    @Test
    void outsideWorkingHoursIsUnprocessable() throws Exception {
        postJson(body("2026-11-03T09:00:00+05:00"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail")
                        .value("time is outside working hours, in time off or in the past"));
    }

    @Test
    void takenTimeIsConflict() throws Exception {
        jdbc.update("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange('2026-11-03 10:00+05'::timestamptz, '2026-11-03 11:00+05'::timestamptz),
                        'confirmed')
                """, client.getId(), classic.getId());

        // last statement: the database transaction is aborted by the exclusion violation
        postJson(body("2026-11-03T10:30:00+05:00"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("time is already booked"));
    }

    private String createAt(String start) throws Exception {
        String json = postJson(body(start)).andExpect(status().isCreated()).andReturn()
                .getResponse().getContentAsString();
        return JsonPath.read(json, "$.id");
    }

    private ResultActions action(String id, String name, String json) throws Exception {
        var request = post("/appointments/" + id + "/" + name)
                .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority())));
        if (json != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(json);
        }
        return mvc.perform(request);
    }

    private ResultActions reschedule(String id, String start) throws Exception {
        return action(id, "reschedule", "{\"start\":\"" + start + "\"}");
    }

    @Test
    void reschedulesAppointment() throws Exception {
        String id = createAt("2026-11-03T10:00:00+05:00");

        reschedule(id, "2026-11-03T13:00:00+05:00")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.start").value("2026-11-03T13:00:00+05:00"))
                .andExpect(jsonPath("$.end").value("2026-11-03T14:00:00+05:00"))
                .andExpect(jsonPath("$.status").value("confirmed"));
    }

    @Test
    void rescheduleOutsideHoursIsUnprocessable() throws Exception {
        String id = createAt("2026-11-03T10:00:00+05:00");

        reschedule(id, "2026-11-03T09:00:00+05:00")
                .andExpect(status().isUnprocessableContent())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail")
                        .value("time is outside working hours, in time off or in the past"));
    }

    @Test
    void rescheduleWithoutStartIsBadRequest() throws Exception {
        String id = createAt("2026-11-03T10:00:00+05:00");

        action(id, "reschedule", "{}")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void cancelsAppointment() throws Exception {
        String id = createAt("2026-11-03T10:00:00+05:00");

        action(id, "cancel", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("cancelled"));
    }

    @Test
    void cancelTwiceIsConflict() throws Exception {
        String id = createAt("2026-11-03T10:00:00+05:00");
        action(id, "cancel", null).andExpect(status().isOk());

        action(id, "cancel", null)
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("appointment is cancelled"));
    }

    @Test
    void marksNoShowAfterStart() throws Exception {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into appointments (id, client_id, service_id, period, status)
                values (?, ?, ?, tstzrange('2026-11-02 09:00+05'::timestamptz, '2026-11-02 10:00+05'::timestamptz),
                        'confirmed')
                """, id, client.getId(), classic.getId());

        action(id.toString(), "no-show", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("no_show"));
    }

    @Test
    void noShowBeforeStartIsConflict() throws Exception {
        String id = createAt("2026-11-03T10:00:00+05:00");

        action(id, "no-show", null)
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("appointment has not started yet"));
    }

    @Test
    void unknownAppointmentIsNotFound() throws Exception {
        String id = UUID.randomUUID().toString();

        reschedule(id, "2026-11-03T13:00:00+05:00").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("appointment not found"));
        action(id, "cancel", null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("appointment not found"));
        action(id, "no-show", null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("appointment not found"));
    }

    @Test
    void invalidIdIsBadRequest() throws Exception {
        action("abc", "cancel", null).andExpect(status().isBadRequest());
    }

    @Test
    void rescheduleIntoTakenTimeIsConflict() throws Exception {
        String id = createAt("2026-11-03T10:00:00+05:00");
        jdbc.update("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange('2026-11-03 13:00+05'::timestamptz, '2026-11-03 14:00+05'::timestamptz),
                        'confirmed')
                """, client.getId(), classic.getId());

        // last statement: the database transaction is aborted by the exclusion violation
        reschedule(id, "2026-11-03T13:30:00+05:00")
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("time is already booked"));
    }
}
