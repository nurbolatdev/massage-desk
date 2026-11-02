package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.errors.ApiProblem;
import com.massagedesk.api.security.StaffRole;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
class TimeOffControllerTests {

    private static final String DAY_OFF = body("2026-11-03T00:00:00+05:00", "2026-11-04T00:00:00+05:00", null);

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @BeforeEach
    void clearTimeOff() {
        jdbc.update("delete from time_off");
    }

    private static String body(String start, String end, String reason) {
        return "{\"start\":\"" + start + "\",\"end\":\"" + end + "\""
                + (reason == null ? "" : ",\"reason\":\"" + reason + "\"") + "}";
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor as(StaffRole role) {
        return jwt().authorities(new SimpleGrantedAuthority(role.authority()));
    }

    private ResultActions postJson(String json, StaffRole role) throws Exception {
        return mvc.perform(post("/time-off").contentType(MediaType.APPLICATION_JSON).content(json).with(as(role)));
    }

    private ResultActions postJson(String json) throws Exception {
        return postJson(json, StaffRole.MASTER);
    }

    private ResultActions list(String query) throws Exception {
        return mvc.perform(get("/time-off" + query).with(as(StaffRole.MASTER)));
    }

    @Test
    void createsADayOff() throws Exception {
        postJson(DAY_OFF)
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.start").value("2026-11-03T00:00:00+05:00"))
                .andExpect(jsonPath("$.end").value("2026-11-04T00:00:00+05:00"))
                .andExpect(jsonPath("$.reason").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void storesTrimmedReasonAndAnswersInTheMastersOffset() throws Exception {
        postJson(body("2026-11-02T19:00:00Z", "2026-11-03T19:00:00Z", "  Trip  "))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.start").value("2026-11-03T00:00:00+05:00"))
                .andExpect(jsonPath("$.end").value("2026-11-04T00:00:00+05:00"))
                .andExpect(jsonPath("$.reason").value("Trip"));
    }

    @Test
    void adminCanCreate() throws Exception {
        postJson(DAY_OFF, StaffRole.ADMIN).andExpect(status().isCreated());
    }

    @Test
    void listsByLocalDays() throws Exception {
        postJson(DAY_OFF).andExpect(status().isCreated());

        list("?from=2026-11-03&to=2026-11-03")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].start").value("2026-11-03T00:00:00+05:00"));
        list("?from=2026-11-04&to=2026-11-05")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void listsAVacationThatStartedEarlierInStartOrder() throws Exception {
        postJson(body("2026-11-05T00:00:00+05:00", "2026-11-06T00:00:00+05:00", "Later")).andExpect(status().isCreated());
        postJson(body("2026-11-01T00:00:00+05:00", "2026-11-10T00:00:00+05:00", "Vacation"))
                .andExpect(status().isCreated());

        list("?from=2026-11-05&to=2026-11-05")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].reason").value("Vacation"))
                .andExpect(jsonPath("$[1].reason").value("Later"));
    }

    @Test
    void deleteRemovesAndUnknownIsNotFound() throws Exception {
        String json = postJson(DAY_OFF).andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(json, "$.id");

        mvc.perform(delete("/time-off/" + id).with(as(StaffRole.MASTER))).andExpect(status().isNoContent());
        list("?from=2026-11-03&to=2026-11-03").andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete("/time-off/" + id).with(as(StaffRole.MASTER)))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("time off not found"));
    }

    @Test
    void invalidIdIsBadRequest() throws Exception {
        mvc.perform(delete("/time-off/abc").with(as(StaffRole.MASTER))).andExpect(status().isBadRequest());
    }

    @Test
    void timeOffOverAConfirmedAppointmentKeepsTheAppointment() throws Exception {
        Client client = clients.saveAndFlush(new Client("+998900000841", "Time off client"));
        MassageService service = services.saveAndFlush(
                new MassageService("Time off service", 60, new BigDecimal("1000.00"), 1));
        jdbc.update("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange('2026-11-03 10:00+05'::timestamptz, '2026-11-03 11:00+05'::timestamptz),
                        'confirmed')
                """, client.getId(), service.getId());

        postJson(withForce(DAY_OFF, "true")).andExpect(status().isCreated());

        assertThat(jdbc.queryForObject(
                "select status from appointments where client_id = ?", String.class, client.getId()))
                .isEqualTo("confirmed");
    }

    private static String withForce(String json, String force) {
        return json.substring(0, json.length() - 1) + ",\"force\":" + force + "}";
    }

    private UUID appointment(Client client, MassageService service, String start, String end, String status) {
        return jdbc.queryForObject("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange(cast(? as timestamptz), cast(? as timestamptz)), ?)
                returning id
                """, UUID.class, client.getId(), service.getId(), start, end, status);
    }

    private MassageService service() {
        return services.saveAndFlush(new MassageService("Time off service", 60, new BigDecimal("1000.00"), 1));
    }

    private long timeOffRows() {
        return jdbc.queryForObject("select count(*) from time_off", Long.class);
    }

    @Test
    void timeOffOverAConfirmedAppointmentAsksForConfirmation() throws Exception {
        Client client = clients.saveAndFlush(new Client("+998900000863", "Time off client"));
        UUID id = appointment(client, service(), "2026-11-03 10:00+05", "2026-11-03 11:00+05", "confirmed");

        postJson(DAY_OFF)
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("time off overlaps confirmed appointments"))
                .andExpect(jsonPath("$.conflicts.length()").value(1))
                .andExpect(jsonPath("$.conflicts[0].appointmentId").value(id.toString()))
                .andExpect(jsonPath("$.conflicts[0].clientName").value("Time off client"))
                .andExpect(jsonPath("$.conflicts[0].start").value("2026-11-03T10:00:00+05:00"))
                .andExpect(jsonPath("$.conflicts[0].end").value("2026-11-03T11:00:00+05:00"))
                .andExpect(jsonPath("$.properties").doesNotExist());
        assertThat(timeOffRows()).isZero();
    }

    @Test
    void forceFalseStillAsksForConfirmation() throws Exception {
        Client client = clients.saveAndFlush(new Client("+998900000863", "Time off client"));
        appointment(client, service(), "2026-11-03 10:00+05", "2026-11-03 11:00+05", "confirmed");

        postJson(withForce(DAY_OFF, "false")).andExpect(status().isConflict());
        assertThat(timeOffRows()).isZero();
    }

    @Test
    void aClientWithoutANameHasANullName() throws Exception {
        Client client = clients.saveAndFlush(new Client("+998900000864", null));
        appointment(client, service(), "2026-11-03 10:00+05", "2026-11-03 11:00+05", "confirmed");

        postJson(DAY_OFF)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.conflicts[0].clientName").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void conflictsAreOrderedByStart() throws Exception {
        Client client = clients.saveAndFlush(new Client("+998900000863", "Time off client"));
        MassageService service = service();
        UUID later = appointment(client, service, "2026-11-03 15:00+05", "2026-11-03 16:00+05", "confirmed");
        UUID earlier = appointment(client, service, "2026-11-03 10:00+05", "2026-11-03 11:00+05", "confirmed");

        postJson(DAY_OFF)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.conflicts.length()").value(2))
                .andExpect(jsonPath("$.conflicts[0].appointmentId").value(earlier.toString()))
                .andExpect(jsonPath("$.conflicts[1].appointmentId").value(later.toString()));
    }

    @Test
    void cancelledAndTouchingAppointmentsAreNoConflict() throws Exception {
        Client client = clients.saveAndFlush(new Client("+998900000863", "Time off client"));
        MassageService service = service();
        appointment(client, service, "2026-11-03 10:00+05", "2026-11-03 11:00+05", "cancelled");
        appointment(client, service, "2026-11-02 23:00+05", "2026-11-03 00:00+05", "confirmed");

        postJson(DAY_OFF).andExpect(status().isCreated());
    }

    @Test
    void forceStoresTheTimeOffAndKeepsTheAppointment() throws Exception {
        Client client = clients.saveAndFlush(new Client("+998900000863", "Time off client"));
        UUID id = appointment(client, service(), "2026-11-03 10:00+05", "2026-11-03 11:00+05", "confirmed");

        postJson(withForce(DAY_OFF, "true")).andExpect(status().isCreated());

        assertThat(timeOffRows()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select status from appointments where id = ?", String.class, id))
                .isEqualTo("confirmed");
    }

    @Test
    void invalidPeriodWinsOverTheConflict() throws Exception {
        Client client = clients.saveAndFlush(new Client("+998900000863", "Time off client"));
        appointment(client, service(), "2026-11-03 10:00+05", "2026-11-03 11:00+05", "confirmed");

        postJson(body("2026-11-03T12:00:00+05:00", "2026-11-03T10:00:00+05:00", null))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    void conflictBodyHasExactlyTheDocumentedMembers() throws Exception {
        Client client = clients.saveAndFlush(new Client("+998900000863", "Time off client"));
        appointment(client, service(), "2026-11-03 10:00+05", "2026-11-03 11:00+05", "confirmed");

        String json = postJson(DAY_OFF).andReturn().getResponse().getContentAsString();
        Map<String, Object> parsed = JsonPath.read(json, "$");

        // "type" is left out of the body while it is the default "about:blank"
        Set<String> documented = new HashSet<>(Arrays.stream(ApiProblem.class.getRecordComponents())
                .map(RecordComponent::getName).toList());
        documented.remove("type");
        assertThat(parsed.keySet()).isEqualTo(documented);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "2026-11-03T10:00:00+05:00|2026-11-03T10:00:00+05:00",
            "2026-10-30T00:00:00+05:00|2026-11-01T00:00:00+05:00",
            "2028-11-04T00:00:00+05:00|2028-11-05T00:00:00+05:00",
            "2026-11-03T00:00:00+05:00|2027-11-05T00:00:00+05:00"})
    void invalidPeriodsAreRefused(String pair) throws Exception {
        String[] p = pair.split("\\|");
        String detail = p[0].equals(p[1]) ? "time off must start before it ends"
                : "time off must end in the future, start within two years and last at most 366 days";

        postJson(body(p[0], p[1], null))
                .andExpect(status().isUnprocessableContent())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value(detail));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"start\":\"2026-11-03T00:00:00+05:00\"}",
            "{\"start\":\"2026-11-03T00:00:00\",\"end\":\"2026-11-04T00:00:00\"}",
            "{\"start\":\"2026-11-03T00:00:00+05:00\",\"end\":\"2026-11-04T00:00:00+05:00\",\"reason\":\"%s\"}",
            "{not json"})
    void invalidBodiesAreBadRequest(String json) throws Exception {
        postJson(json.replace("%s", "x".repeat(201)))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void listNeedsBothDatesInOrderAndAtMostAYear() throws Exception {
        list("?from=2026-11-03").andExpect(status().isBadRequest());
        list("?from=2026-11-05&to=2026-11-04")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("from must not be after to"));
        list("?from=2026-01-01&to=2027-01-02")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("range must be at most 366 days"));
        list("?from=2026-01-01&to=2027-01-01").andExpect(status().isOk());
    }

    @Test
    void listDatesOutsideTheSaneWindowAreBadRequest() throws Exception {
        list("?from=+999999999-12-31&to=+999999999-12-31").andExpect(status().isBadRequest());
        list("?from=2101-01-01&to=2101-01-01")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("dates must be within 2000-01-01..2100-12-31"));
        list("?from=1999-12-31&to=2000-01-01").andExpect(status().isBadRequest());
        list("?from=2100-12-31&to=2100-12-31").andExpect(status().isOk());
    }

    @Test
    void noTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/time-off?from=2026-11-03&to=2026-11-03")).andExpect(status().isUnauthorized());
    }
}
