package com.massagedesk.api.booking;

import static org.hamcrest.Matchers.endsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class ClientAppointmentsTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private AppointmentRepository appointments;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    private Client client;
    private Client otherClient;
    private Appointment futureConfirmed;
    private Appointment pastNoShow;
    private Appointment pastCancelled;

    @BeforeEach
    void setUp() {
        client = clients.saveAndFlush(new Client("+998900000901", "Aigul"));
        otherClient = clients.saveAndFlush(new Client("+998900000902", "Bek"));
        MassageService classic = services.saveAndFlush(
                new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
        MassageService back = services.saveAndFlush(
                new MassageService("Back", 45, new BigDecimal("80000.00"), 2));

        futureConfirmed = save(client, back, "2026-11-05T05:00:00Z", "2026-11-05T05:45:00Z");

        Appointment noShow = save(client, classic, "2026-10-20T05:00:00Z", "2026-10-20T06:00:00Z");
        noShow.markNoShow(FixedClockConfiguration.NOW);
        pastNoShow = appointments.saveAndFlush(noShow);

        Appointment cancelled = save(client, classic, "2026-10-10T05:00:00Z", "2026-10-10T06:00:00Z");
        cancelled.cancel();
        pastCancelled = appointments.saveAndFlush(cancelled);

        save(otherClient, classic, "2026-11-06T05:00:00Z", "2026-11-06T06:00:00Z");
    }

    private Appointment save(Client forClient, MassageService service, String start, String end) {
        return appointments.saveAndFlush(new Appointment(forClient, service,
                new TimeRange(Instant.parse(start), Instant.parse(end)), AppointmentSource.MANUAL));
    }

    private ResultActions send(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))));
    }

    @Test
    void listsClientAppointmentsNewestFirstAcrossAllStatuses() throws Exception {
        send(get("/clients/{id}/appointments", client.getId()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(futureConfirmed.getId().toString()))
                .andExpect(jsonPath("$[0].serviceName").value("Back"))
                .andExpect(jsonPath("$[0].status").value("confirmed"))
                .andExpect(jsonPath("$[0].start").value(endsWith("+05:00")))
                .andExpect(jsonPath("$[1].id").value(pastNoShow.getId().toString()))
                .andExpect(jsonPath("$[1].status").value("no_show"))
                .andExpect(jsonPath("$[2].id").value(pastCancelled.getId().toString()))
                .andExpect(jsonPath("$[2].status").value("cancelled"));
    }

    @Test
    void excludesOtherClientsAppointments() throws Exception {
        send(get("/clients/{id}/appointments", otherClient.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].clientId").value(otherClient.getId().toString()));
    }

    @Test
    void paginatesWithLimitAndOffset() throws Exception {
        send(get("/clients/{id}/appointments", client.getId()).param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(futureConfirmed.getId().toString()))
                .andExpect(jsonPath("$[1].id").value(pastNoShow.getId().toString()));

        send(get("/clients/{id}/appointments", client.getId()).param("limit", "2").param("offset", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(pastCancelled.getId().toString()));
    }

    @Test
    void clientWithoutAppointmentsReturnsEmptyArray() throws Exception {
        Client empty = clients.saveAndFlush(new Client("+998900000903", "Empty"));

        send(get("/clients/{id}/appointments", empty.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void unknownClientIsNotFound() throws Exception {
        send(get("/clients/{id}/appointments", UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("client not found"));
    }

    @Test
    void invalidIdAndQueryParamsAreBadRequest() throws Exception {
        send(get("/clients/abc/appointments"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));

        for (String[] p : new String[][] {{"limit", "0"}, {"limit", "201"}, {"offset", "-1"}}) {
            send(get("/clients/{id}/appointments", client.getId()).param(p[0], p[1]))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
        }
    }

    @Test
    void requiresToken() throws Exception {
        mvc.perform(get("/clients/{id}/appointments", client.getId()))
                .andExpect(status().isUnauthorized());
    }
}
