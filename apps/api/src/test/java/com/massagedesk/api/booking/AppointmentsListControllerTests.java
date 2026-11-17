package com.massagedesk.api.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.TimeRange;
import com.massagedesk.api.security.StaffRole;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class AppointmentsListControllerTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private AppointmentRepository appointments;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    private Appointment booked;

    @BeforeEach
    void setUp() {
        Client client = clients.saveAndFlush(new Client("+998900000801", "Aigul"));
        MassageService classic = services.saveAndFlush(
                new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
        booked = appointments.saveAndFlush(new Appointment(client, classic,
                new TimeRange(Instant.parse("2026-11-03T05:00:00Z"), Instant.parse("2026-11-03T06:00:00Z")),
                AppointmentSource.BOT));
    }

    private ResultActions list(String query) throws Exception {
        return mvc.perform(get("/appointments" + query)
                .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))));
    }

    private ResultActions one(String id) throws Exception {
        return mvc.perform(get("/appointments/" + id)
                .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))));
    }

    @Test
    void listsAppointmentsOfTheDay() throws Exception {
        list("?from=2026-11-03&to=2026-11-03")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").isNotEmpty())
                .andExpect(jsonPath("$[0].clientName").value("Aigul"))
                .andExpect(jsonPath("$[0].clientPhone").value("+998900000801"))
                .andExpect(jsonPath("$[0].serviceName").value("Classic"))
                .andExpect(jsonPath("$[0].start").value("2026-11-03T10:00:00+05:00"))
                .andExpect(jsonPath("$[0].end").value("2026-11-03T11:00:00+05:00"))
                .andExpect(jsonPath("$[0].status").value("confirmed"))
                .andExpect(jsonPath("$[0].source").value("bot"));
    }

    @Test
    void anotherDayIsEmpty() throws Exception {
        list("?from=2026-11-04&to=2026-11-04")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void missingDateIsBadRequest() throws Exception {
        list("?from=2026-11-03")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void invalidDateIsBadRequest() throws Exception {
        list("?from=nope&to=2026-11-03")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void fromAfterToIsBadRequest() throws Exception {
        list("?from=2026-11-05&to=2026-11-04")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.detail").value("from must not be after to"));
    }

    @Test
    void rangeOfMoreThan62DaysIsBadRequest() throws Exception {
        list("?from=2026-01-01&to=2026-03-04")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.detail").value("range must be at most 62 days"));
        list("?from=2026-01-01&to=2026-03-03").andExpect(status().isOk());
    }

    @Test
    void datesOutsideTheSaneWindowAreBadRequest() throws Exception {
        list("?from=2101-01-01&to=2101-01-01")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.detail").value("dates must be within 2000-01-01..2100-12-31"));
    }

    @Test
    void noTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/appointments?from=2026-11-03&to=2026-11-03")).andExpect(status().isUnauthorized());
    }

    @Test
    void getsOneAppointmentWithNames() throws Exception {
        one(booked.getId().toString())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(booked.getId().toString()))
                .andExpect(jsonPath("$.clientName").value("Aigul"))
                .andExpect(jsonPath("$.clientPhone").value("+998900000801"))
                .andExpect(jsonPath("$.serviceName").value("Classic"))
                .andExpect(jsonPath("$.start").value("2026-11-03T10:00:00+05:00"))
                .andExpect(jsonPath("$.end").value("2026-11-03T11:00:00+05:00"))
                .andExpect(jsonPath("$.status").value("confirmed"))
                .andExpect(jsonPath("$.source").value("bot"));
    }

    @Test
    void oneAppointmentMatchesTheListItem() throws Exception {
        String single = one(booked.getId().toString()).andReturn().getResponse().getContentAsString();
        String listed = list("?from=2026-11-03&to=2026-11-03").andReturn().getResponse().getContentAsString();
        Map<String, Object> singleItem = JsonPath.read(single, "$");
        Map<String, Object> listedItem = JsonPath.read(listed, "$[0]");
        assertThat(singleItem).isEqualTo(listedItem);
    }

    @Test
    void getsACancelledAppointment() throws Exception {
        booked.cancel();
        appointments.saveAndFlush(booked);
        one(booked.getId().toString())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("cancelled"));
    }

    @Test
    void unknownIdIs404() throws Exception {
        one(UUID.randomUUID().toString())
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("APPOINTMENT_NOT_FOUND"));
    }

    @Test
    void oneWithoutTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/appointments/" + booked.getId())).andExpect(status().isUnauthorized());
    }

    @Test
    void oneWithoutStaffRoleIsForbidden() throws Exception {
        mvc.perform(get("/appointments/" + booked.getId()).with(jwt())).andExpect(status().isForbidden());
    }
}
