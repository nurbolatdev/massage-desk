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
import java.util.List;
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

    @Test
    void listIncludesVisitStatsMatchingStatsEndpoint() throws Exception {
        clients.saveAndFlush(new Client("+998900000915", "No Visits"));

        String listBody = send(get("/clients").param("q", "00000911"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].stats.visits").value(3))
                .andExpect(jsonPath("$[0].stats.noShows").value(1))
                .andExpect(jsonPath("$[0].stats.lastVisitAt").value("2026-10-12T10:00:00+05:00"))
                .andExpect(jsonPath("$[0].stats.nextAppointmentAt").value("2026-11-03T10:00:00+05:00"))
                .andExpect(jsonPath("$[0].stats.visitIntervalDays").value(14))
                .andReturn()
                .getResponse()
                .getContentAsString();

        BigDecimal listSpent = new BigDecimal(JsonPath.read(listBody, "$[0].stats.totalSpent").toString());
        assertThat(listSpent).isEqualByComparingTo("280000.00");

        String statsBody = send(get("/clients/{id}/stats", clientA.getId()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        Map<String, Object> listStats = JsonPath.read(listBody, "$[0].stats");
        Map<String, Object> oneStats = JsonPath.read(statsBody, "$");
        assertThat(listStats).isEqualTo(oneStats);

        send(get("/clients").param("q", "00000915"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].stats.visits").value(0))
                .andExpect(jsonPath("$[0].stats.lastVisitAt").value(nullValue()));
    }

    @Test
    void filtersBySegmentAndPreservesNameOrder() throws Exception {
        Client regular = clients.saveAndFlush(new Client("+998900000931", "Boris"));
        save(regular, classic, "2026-09-10T05:00:00Z", "2026-09-10T06:00:00Z");
        save(regular, classic, "2026-10-01T05:00:00Z", "2026-10-01T06:00:00Z");
        save(regular, classic, "2026-10-20T05:00:00Z", "2026-10-20T06:00:00Z");

        Client regularBooked = clients.saveAndFlush(new Client("+998900000932", "Anna"));
        save(regularBooked, classic, "2026-07-01T05:00:00Z", "2026-07-01T06:00:00Z");
        save(regularBooked, classic, "2026-07-08T05:00:00Z", "2026-07-08T06:00:00Z");
        save(regularBooked, classic, "2026-07-15T05:00:00Z", "2026-07-15T06:00:00Z");
        save(regularBooked, classic, "2026-07-22T05:00:00Z", "2026-07-22T06:00:00Z");
        save(regularBooked, classic, "2026-08-01T05:00:00Z", "2026-08-01T06:00:00Z");
        save(regularBooked, classic, "2026-11-20T05:00:00Z", "2026-11-20T06:00:00Z");

        Client lapsed = clients.saveAndFlush(new Client("+998900000933", "Clara"));
        save(lapsed, classic, "2026-07-02T05:00:00Z", "2026-07-02T06:00:00Z");
        save(lapsed, classic, "2026-08-01T07:00:00Z", "2026-08-01T08:00:00Z");

        Client withNoShow = clients.saveAndFlush(new Client("+998900000934", "Dina"));
        save(withNoShow, classic, "2026-10-25T05:00:00Z", "2026-10-25T06:00:00Z");
        Appointment noShow = save(withNoShow, classic, "2026-10-26T05:00:00Z", "2026-10-26T06:00:00Z");
        noShow.markNoShow(FixedClockConfiguration.NOW);
        appointments.saveAndFlush(noShow);

        clients.saveAndFlush(new Client("+998900000935", "Elena"));

        assertThat(listPhones("0000093", null))
                .containsExactlyInAnyOrder(
                        "+998900000931", "+998900000932", "+998900000933", "+998900000934", "+998900000935");
        assertThat(listPhones("0000093", "regular"))
                .containsExactly("+998900000932", "+998900000931");
        assertThat(listPhones("0000093", "lapsed"))
                .containsExactlyInAnyOrder("+998900000933");
        assertThat(listPhones("0000093", "no_shows"))
                .containsExactlyInAnyOrder("+998900000934");
    }

    @Test
    void sixtyDayBoundaryDecidesBetweenRegularAndLapsed() throws Exception {
        Client onBoundary = clients.saveAndFlush(new Client("+998900000951", "Edge On"));
        save(onBoundary, classic, "2026-07-01T05:00:00Z", "2026-07-01T06:00:00Z");
        save(onBoundary, classic, "2026-08-01T05:00:00Z", "2026-08-01T06:00:00Z");
        save(onBoundary, classic, "2026-09-03T05:15:00Z", "2026-09-03T06:15:00Z");

        Client justBefore = clients.saveAndFlush(new Client("+998900000952", "Edge Off"));
        save(justBefore, classic, "2026-07-02T05:00:00Z", "2026-07-02T06:00:00Z");
        save(justBefore, classic, "2026-08-02T05:00:00Z", "2026-08-02T06:00:00Z");
        save(justBefore, classic, "2026-09-03T04:14:00Z", "2026-09-03T05:14:00Z");

        assertThat(listPhones("0000095", "regular")).containsExactly("+998900000951");
        assertThat(listPhones("0000095", "lapsed")).containsExactly("+998900000952");
    }

    @Test
    void emptySegmentListsEveryone() throws Exception {
        clients.saveAndFlush(new Client("+998900000961", "Empty Segment"));

        assertThat(listPhones("0000096", "")).containsExactly("+998900000961");
    }

    @Test
    void summaryCountsTotalAndRecentClientsWithoutCollidingWithGetById() throws Exception {
        String beforeBody = send(get("/clients/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").isNumber())
                .andExpect(jsonPath("$.newLast30Days").isNumber())
                .andReturn()
                .getResponse()
                .getContentAsString();
        long totalBefore = ((Number) JsonPath.read(beforeBody, "$.total")).longValue();
        long newBefore = ((Number) JsonPath.read(beforeBody, "$.newLast30Days")).longValue();

        Client oldClient = clients.saveAndFlush(new Client("+998900000941", "Old Client"));
        jdbc.update("update clients set created_at = '2026-09-01T00:00:00Z' where id = ?", oldClient.getId());
        clients.saveAndFlush(new Client("+998900000942", "New Client"));

        send(get("/clients/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(totalBefore + 2))
                .andExpect(jsonPath("$.newLast30Days").value(newBefore + 1));
    }

    private List<String> listPhones(String q, String segment) throws Exception {
        MockHttpServletRequestBuilder req = get("/clients").param("q", q);
        if (segment != null) {
            req = req.param("segment", segment);
        }
        String body = send(req)
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$[*].phone");
    }
}
