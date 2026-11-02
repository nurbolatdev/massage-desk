package com.massagedesk.api.schedule;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.security.StaffRole;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Every schedule change is made through the API and followed by a free-time query. Deliberately
 * not {@code @Transactional}: each request commits on its own, so a stale cache between requests
 * would show up here. Everything the tests create is removed in {@link #cleanUp()}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class ScheduleChangesReachSlotsTests {

    private static final String DAY = "2026-11-03";
    private static final String PHONE = "+998900000830";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    private final List<String> serviceIds = new ArrayList<>();
    private final List<String> clientIds = new ArrayList<>();
    private final List<String> appointmentIds = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from working_hours");
        jdbc.update("delete from time_off");
        for (String id : appointmentIds) {
            jdbc.update("delete from events where entity_id = ?", UUID.fromString(id));
            jdbc.update("delete from appointments where id = ?", UUID.fromString(id));
        }
        jdbc.update("update settings set time_zone = 'Asia/Tashkent', address = null, bot_enabled = true");
        for (String id : clientIds) {
            jdbc.update("delete from appointments where client_id = ?", UUID.fromString(id));
            jdbc.update("delete from events where entity_id = ?", UUID.fromString(id));
            jdbc.update("delete from clients where id = ?", UUID.fromString(id));
        }
        for (String id : serviceIds) {
            jdbc.update("delete from appointments where service_id = ?", UUID.fromString(id));
            jdbc.update("delete from services where id = ?", UUID.fromString(id));
        }
    }

    private ResultActions send(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.with(jwt().authorities(
                new SimpleGrantedAuthority(StaffRole.MASTER.authority()))));
    }

    private ResultActions sendJson(MockHttpServletRequestBuilder request, String json) throws Exception {
        return send(request.contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private String createService(int durationMin) throws Exception {
        String body = sendJson(post("/services"), """
                {"name":"Schedule change test","durationMin":%d,"price":100000}
                """.formatted(durationMin))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        serviceIds.add(id);
        return id;
    }

    private String createClient() throws Exception {
        String body = sendJson(post("/clients"), "{\"phone\":\"" + PHONE + "\",\"name\":\"Schedule client\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        clientIds.add(id);
        return id;
    }

    private static final String OUTSIDE_SCHEDULE =
            "time is outside working hours, in time off or in the past";

    private String book(String client, String service, String start) throws Exception {
        String body = sendJson(post("/appointments"), """
                {"clientId":"%s","serviceId":"%s","start":"%s"}
                """.formatted(client, service, start))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        appointmentIds.add(id);
        return id;
    }

    private void bookingRefused(String client, String service, String start) throws Exception {
        sendJson(post("/appointments"), """
                {"clientId":"%s","serviceId":"%s","start":"%s"}
                """.formatted(client, service, start))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(OUTSIDE_SCHEDULE));
    }

    private void putHours(String blocksJson) throws Exception {
        sendJson(put("/working-hours"), "{\"blocks\":" + blocksJson + "}").andExpect(status().isOk());
    }

    private String tuesday(String start, String end) {
        return "{\"weekday\":2,\"start\":\"" + start + "\",\"end\":\"" + end + "\"}";
    }

    private ResultActions slots(String serviceId) throws Exception {
        return send(get("/slots").param("serviceId", serviceId).param("day", DAY));
    }

    @Test
    void workingHoursChangeAppliesImmediately() throws Exception {
        String service = createService(60);
        String client = createClient();
        slots(service).andExpect(status().isOk()).andExpect(jsonPath("$.starts", empty()));

        putHours("[" + tuesday("10:00", "12:00") + "]");
        slots(service).andExpect(status().isOk()).andExpect(jsonPath("$.starts", contains(
                "2026-11-03T10:00:00+05:00",
                "2026-11-03T10:30:00+05:00",
                "2026-11-03T11:00:00+05:00")));

        putHours("[" + tuesday("14:00", "15:00") + "]");
        slots(service).andExpect(status().isOk()).andExpect(jsonPath("$.starts", contains(
                "2026-11-03T14:00:00+05:00")));
        bookingRefused(client, service, "2026-11-03T10:00:00+05:00");
        book(client, service, "2026-11-03T14:00:00+05:00");

        putHours("[]");
        slots(service).andExpect(status().isOk()).andExpect(jsonPath("$.starts", empty()));
    }

    @Test
    void timeOffAppliesAndDeleteRestores() throws Exception {
        String service = createService(60);
        String client = createClient();
        putHours("[" + tuesday("10:00", "12:00") + "]");

        String created = sendJson(post("/time-off"), """
                {"start":"2026-11-03T10:00:00+05:00","end":"2026-11-03T11:00:00+05:00"}
                """).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String timeOffId = JsonPath.read(created, "$.id");

        slots(service).andExpect(status().isOk()).andExpect(jsonPath("$.starts", contains(
                "2026-11-03T11:00:00+05:00")));
        bookingRefused(client, service, "2026-11-03T10:00:00+05:00");

        send(delete("/time-off/" + timeOffId)).andExpect(status().isNoContent());
        slots(service).andExpect(status().isOk()).andExpect(jsonPath("$.starts", contains(
                "2026-11-03T10:00:00+05:00",
                "2026-11-03T10:30:00+05:00",
                "2026-11-03T11:00:00+05:00")));
        book(client, service, "2026-11-03T10:00:00+05:00");
    }

    @Test
    void serviceChangesApply() throws Exception {
        String service = createService(60);
        putHours("[" + tuesday("10:00", "12:00") + "]");

        sendJson(patch("/services/" + service), "{\"durationMin\":120}").andExpect(status().isOk());
        slots(service).andExpect(status().isOk()).andExpect(jsonPath("$.starts", contains(
                "2026-11-03T10:00:00+05:00")));

        sendJson(patch("/services/" + service), "{\"active\":false}").andExpect(status().isOk());
        slots(service).andExpect(status().isNotFound());
    }

    @Test
    void timeZoneChangeApplies() throws Exception {
        String service = createService(60);
        putHours("[" + tuesday("21:00", "23:00") + "]");

        sendJson(patch("/settings"), "{\"timeZone\":\"America/New_York\"}").andExpect(status().isOk());
        slots(service).andExpect(status().isOk()).andExpect(jsonPath("$.starts", contains(
                "2026-11-03T21:00:00-05:00",
                "2026-11-03T21:30:00-05:00",
                "2026-11-03T22:00:00-05:00")));
    }
}
