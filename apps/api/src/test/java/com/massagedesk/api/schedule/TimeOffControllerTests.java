package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.security.StaffRole;
import java.math.BigDecimal;
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

        postJson(DAY_OFF).andExpect(status().isCreated());

        assertThat(jdbc.queryForObject(
                "select status from appointments where client_id = ?", String.class, client.getId()))
                .isEqualTo("confirmed");
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
    void noTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/time-off?from=2026-11-03&to=2026-11-03")).andExpect(status().isUnauthorized());
    }
}
