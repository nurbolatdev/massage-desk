package com.massagedesk.api.clients;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.Appointment;
import com.massagedesk.api.booking.AppointmentRepository;
import com.massagedesk.api.booking.AppointmentSource;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class ClientStatsTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private AppointmentRepository appointments;

    @Autowired
    private JdbcTemplate jdbc;

    private Client clientA;
    private MassageService classic;
    private MassageService back;

    @BeforeEach
    void setUp() {
        clientA = clients.saveAndFlush(new Client("+998900000911", "Aziza"));
        classic = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
        back = services.saveAndFlush(new MassageService("Back", 45, new BigDecimal("80000.00"), 2));

        Appointment doneVisit = save(clientA, back, "2026-10-12T05:00:00Z", "2026-10-12T05:45:00Z");
        jdbc.update("update appointments set status = 'done' where id = ?", doneVisit.getId());

        save(clientA, classic, "2026-09-28T05:00:00Z", "2026-09-28T06:00:00Z");
        save(clientA, classic, "2026-09-14T05:00:00Z", "2026-09-14T06:00:00Z");

        Appointment noShow = save(clientA, classic, "2026-10-19T05:00:00Z", "2026-10-19T06:00:00Z");
        noShow.markNoShow(FixedClockConfiguration.NOW);
        appointments.saveAndFlush(noShow);

        Appointment cancelled = save(clientA, classic, "2026-10-05T05:00:00Z", "2026-10-05T06:00:00Z");
        cancelled.cancel();
        appointments.saveAndFlush(cancelled);

        save(clientA, classic, "2026-11-02T05:00:00Z", "2026-11-02T06:00:00Z");
        save(clientA, classic, "2026-11-03T05:00:00Z", "2026-11-03T06:00:00Z");
        save(clientA, classic, "2026-11-10T05:00:00Z", "2026-11-10T06:00:00Z");
    }

    private Appointment save(Client client, MassageService service, String start, String end) {
        return appointments.saveAndFlush(new Appointment(
                client,
                service,
                new TimeRange(Instant.parse(start), Instant.parse(end)),
                AppointmentSource.MANUAL));
    }

    private ResultActions send(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))));
    }

    @Test
    void computesStatsForClientWithVisitsNoShowsAndFutureAppointment() throws Exception {
        Client other = clients.saveAndFlush(new Client("+998900000914", "Other"));
        save(other, classic, "2026-10-16T05:00:00Z", "2026-10-16T06:00:00Z");
        Appointment otherNoShow = save(other, classic, "2026-10-17T05:00:00Z", "2026-10-17T06:00:00Z");
        otherNoShow.markNoShow(FixedClockConfiguration.NOW);
        appointments.saveAndFlush(otherNoShow);
        save(other, classic, "2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z");

        String body = send(get("/clients/{id}/stats", clientA.getId()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.visits").value(3))
                .andExpect(jsonPath("$.noShows").value(1))
                .andExpect(jsonPath("$.lastVisitAt").value("2026-10-12T10:00:00+05:00"))
                .andExpect(jsonPath("$.nextAppointmentAt").value("2026-11-03T10:00:00+05:00"))
                .andExpect(jsonPath("$.visitIntervalDays").value(14))
                .andReturn()
                .getResponse()
                .getContentAsString();

        BigDecimal totalSpent = new BigDecimal(JsonPath.read(body, "$.totalSpent").toString());
        assertThat(totalSpent).isEqualByComparingTo("280000.00");
    }

    @Test
    void returnsZeroesAndNullFieldsForClientWithoutAppointments() throws Exception {
        Client empty = clients.saveAndFlush(new Client("+998900000912", "Empty"));

        String body = send(get("/clients/{id}/stats", empty.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visits").value(0))
                .andExpect(jsonPath("$.totalSpent").value(0))
                .andExpect(jsonPath("$.noShows").value(0))
                .andExpect(jsonPath("$.lastVisitAt").value(nullValue()))
                .andExpect(jsonPath("$.nextAppointmentAt").value(nullValue()))
                .andExpect(jsonPath("$.visitIntervalDays").value(nullValue()))
                .andReturn()
                .getResponse()
                .getContentAsString();

        Map<String, Object> parsed = JsonPath.read(body, "$");
        assertThat(parsed).containsKeys("lastVisitAt", "nextAppointmentAt", "visitIntervalDays");
    }

    @Test
    void singleVisitLeavesVisitIntervalDaysNull() throws Exception {
        Client single = clients.saveAndFlush(new Client("+998900000913", "Single"));
        save(single, back, "2026-10-15T05:00:00Z", "2026-10-15T05:45:00Z");

        String body = send(get("/clients/{id}/stats", single.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visits").value(1))
                .andExpect(jsonPath("$.noShows").value(0))
                .andExpect(jsonPath("$.lastVisitAt").value("2026-10-15T10:00:00+05:00"))
                .andExpect(jsonPath("$.nextAppointmentAt").value(nullValue()))
                .andExpect(jsonPath("$.visitIntervalDays").value(nullValue()))
                .andReturn()
                .getResponse()
                .getContentAsString();

        BigDecimal totalSpent = new BigDecimal(JsonPath.read(body, "$.totalSpent").toString());
        assertThat(totalSpent).isEqualByComparingTo("80000.00");
    }

    @Test
    void unknownClientIsNotFoundAndInvalidIdIsBadRequest() throws Exception {
        send(get("/clients/{id}/stats", UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("client not found"));

        send(get("/clients/abc/stats"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void requiresToken() throws Exception {
        mvc.perform(get("/clients/{id}/stats", clientA.getId()))
                .andExpect(status().isUnauthorized());
    }
}
