package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.security.StaffRole;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
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
class WorkingHoursControllerTests {

    private static final String MOCKUP_WEEK = IntStream.rangeClosed(1, 5)
            .mapToObj(d -> block(d, "09:00", "13:00") + "," + block(d, "14:00", "19:00"))
            .collect(Collectors.joining(",")) + "," + block(6, "10:00", "15:00");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @BeforeEach
    void clearHours() {
        jdbc.update("delete from working_hours");
    }

    private static String block(int weekday, String start, String end) {
        return "{\"weekday\":" + weekday + ",\"start\":\"" + start + "\",\"end\":\"" + end + "\"}";
    }

    private ResultActions putHours(String json, StaffRole role) throws Exception {
        return mvc.perform(put("/working-hours").contentType(MediaType.APPLICATION_JSON).content(json)
                .with(jwt().authorities(new SimpleGrantedAuthority(role.authority()))));
    }

    private ResultActions putHours(String json) throws Exception {
        return putHours(json, StaffRole.MASTER);
    }

    private ResultActions getHours() throws Exception {
        return mvc.perform(get("/working-hours")
                .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))));
    }

    @Test
    void storesTheMockupWeek() throws Exception {
        putHours("{\"blocks\":[" + MOCKUP_WEEK + "]}")
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.blocks.length()").value(11))
                .andExpect(jsonPath("$.blocks[0].weekday").value(1))
                .andExpect(jsonPath("$.blocks[0].start").value("09:00"))
                .andExpect(jsonPath("$.blocks[0].end").value("13:00"))
                .andExpect(jsonPath("$.blocks[1].start").value("14:00"))
                .andExpect(jsonPath("$.blocks[1].end").value("19:00"))
                .andExpect(jsonPath("$.blocks[10].weekday").value(6))
                .andExpect(jsonPath("$.blocks[10].start").value("10:00"));

        getHours()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocks.length()").value(11))
                .andExpect(jsonPath("$.blocks[0].start").value("09:00"))
                .andExpect(jsonPath("$.blocks[10].end").value("15:00"));
    }

    @Test
    void unorderedInputIsReturnedInOrder() throws Exception {
        putHours("{\"blocks\":[" + block(2, "14:00", "16:00") + "," + block(1, "09:00", "10:00") + ","
                + block(2, "09:00", "10:00") + "]}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocks[0].weekday").value(1))
                .andExpect(jsonPath("$.blocks[1].weekday").value(2))
                .andExpect(jsonPath("$.blocks[1].start").value("09:00"))
                .andExpect(jsonPath("$.blocks[2].start").value("14:00"));
    }

    @Test
    void emptyListClearsTheWeek() throws Exception {
        putHours("{\"blocks\":[" + block(1, "09:00", "10:00") + "]}").andExpect(status().isOk());

        putHours("{\"blocks\":[]}").andExpect(status().isOk()).andExpect(jsonPath("$.blocks.length()").value(0));

        getHours().andExpect(status().isOk()).andExpect(jsonPath("$.blocks.length()").value(0));
    }

    @Test
    void adminCanReplace() throws Exception {
        putHours("{\"blocks\":[" + block(1, "09:00", "10:00") + "]}", StaffRole.ADMIN).andExpect(status().isOk());
    }

    @Test
    void startAfterEndIsUnprocessable() throws Exception {
        putHours("{\"blocks\":[" + block(1, "13:00", "09:00") + "]}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("block must start before it ends"));
    }

    @Test
    void startEqualToEndIsUnprocessable() throws Exception {
        putHours("{\"blocks\":[" + block(1, "09:00", "09:00") + "]}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("block must start before it ends"));
    }

    @Test
    void touchingBlocksAreUnprocessable() throws Exception {
        putHours("{\"blocks\":[" + block(1, "09:00", "13:00") + "," + block(1, "13:00", "17:00") + "]}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("blocks of one day must not overlap or touch"));
    }

    @Test
    void overlappingBlocksAreUnprocessable() throws Exception {
        putHours("{\"blocks\":[" + block(1, "09:00", "13:00") + "," + block(1, "12:00", "17:00") + "]}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("blocks of one day must not overlap or touch"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"blocks\":[{\"weekday\":0,\"start\":\"09:00\",\"end\":\"10:00\"}]}",
            "{\"blocks\":[{\"weekday\":8,\"start\":\"09:00\",\"end\":\"10:00\"}]}",
            "{\"blocks\":[{\"weekday\":1,\"start\":\"9:00\",\"end\":\"10:00\"}]}",
            "{\"blocks\":[{\"weekday\":1,\"start\":\"09:00\",\"end\":\"24:00\"}]}",
            "{\"blocks\":[{\"weekday\":1,\"start\":\"09:00:00\",\"end\":\"10:00\"}]}",
            "{\"blocks\":[{\"weekday\":1,\"start\":\"09:00\"}]}",
            "{\"blocks\":[{\"start\":\"09:00\",\"end\":\"10:00\"}]}",
            "{}",
            "{\"blocks\":null}",
            "{\"blocks\":[null]}",
            "{\"blocks\":[",
            "not json"
    })
    void invalidBodiesAreBadRequests(String json) throws Exception {
        putHours(json)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void tooManyBlocksAreBadRequest() throws Exception {
        String blocks = IntStream.range(0, 51).mapToObj(i -> block(1, "09:00", "10:00"))
                .collect(Collectors.joining(","));
        putHours("{\"blocks\":[" + blocks + "]}").andExpect(status().isBadRequest());
    }

    @Test
    void noTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/working-hours")).andExpect(status().isUnauthorized());
    }

    private static final String TUESDAY_APPOINTMENT_START = "2026-11-03 14:00+05";
    private static final String TUESDAY_APPOINTMENT_END = "2026-11-03 15:00+05";

    private static String week(String... blocks) {
        return "{\"blocks\":[" + String.join(",", blocks) + "]}";
    }

    private static String forced(String json) {
        return json.substring(0, json.length() - 1) + ",\"force\":true}";
    }

    private UUID appointment(String phone, String name, String start, String end, String status) {
        Client client = clients.saveAndFlush(new Client(phone, name));
        MassageService service = services.saveAndFlush(
                new MassageService("Hours conflict service", 60, new BigDecimal("1000.00"), 1));
        return jdbc.queryForObject("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange(cast(? as timestamptz), cast(? as timestamptz)), ?)
                returning id
                """, UUID.class, client.getId(), service.getId(), start, end, status);
    }

    private UUID tuesdayAppointment() {
        return appointment("+998900000865", "Hours client", TUESDAY_APPOINTMENT_START, TUESDAY_APPOINTMENT_END,
                "confirmed");
    }

    private void storeTuesday(String start, String end) throws Exception {
        putHours(week(block(2, start, end))).andExpect(status().isOk());
    }

    private String storedWeek() {
        return jdbc.queryForObject("""
                select coalesce(string_agg(weekday || ' ' || start_time || '-' || end_time, ',' order by weekday,
                start_time), '') from working_hours
                """, String.class);
    }

    @Test
    void hoursThatLeaveAnAppointmentOutAskForConfirmation() throws Exception {
        UUID id = tuesdayAppointment();
        storeTuesday("10:00", "16:00");

        putHours(week(block(2, "10:00", "13:00")))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("confirmed appointments are outside the new working hours"))
                .andExpect(jsonPath("$.conflicts.length()").value(1))
                .andExpect(jsonPath("$.conflicts[0].appointmentId").value(id.toString()))
                .andExpect(jsonPath("$.conflicts[0].clientName").value("Hours client"))
                .andExpect(jsonPath("$.conflicts[0].start").value("2026-11-03T14:00:00+05:00"))
                .andExpect(jsonPath("$.conflicts[0].end").value("2026-11-03T15:00:00+05:00"))
                .andExpect(jsonPath("$.properties").doesNotExist());
        assertThat(storedWeek()).isEqualTo("2 10:00:00-16:00:00");
    }

    @Test
    void hoursThatStillCoverTheAppointmentAreStored() throws Exception {
        tuesdayAppointment();
        storeTuesday("10:00", "16:00");

        putHours(week(block(2, "10:00", "15:00"))).andExpect(status().isOk());
    }

    @Test
    void hoursThatCoverTheAppointmentOnlyPartlyAreRefused() throws Exception {
        tuesdayAppointment();

        putHours(week(block(2, "14:30", "18:00"))).andExpect(status().isConflict());
    }

    @Test
    void aBreakInsideTheAppointmentIsRefused() throws Exception {
        tuesdayAppointment();

        putHours(week(block(2, "10:00", "14:30"), block(2, "14:45", "18:00"))).andExpect(status().isConflict());
    }

    @Test
    void forceStoresTheWeekAndKeepsTheAppointment() throws Exception {
        UUID id = tuesdayAppointment();

        putHours(forced(week(block(2, "10:00", "13:00")))).andExpect(status().isOk());

        assertThat(storedWeek()).isEqualTo("2 10:00:00-13:00:00");
        assertThat(jdbc.queryForObject("select status from appointments where id = ?", String.class, id))
                .isEqualTo("confirmed");
    }

    @Test
    void forceFalseStillAsksForConfirmation() throws Exception {
        tuesdayAppointment();
        String json = week(block(2, "10:00", "13:00"));

        putHours(json.substring(0, json.length() - 1) + ",\"force\":false}").andExpect(status().isConflict());
    }

    @Test
    void anAppointmentBeyondTheHorizonIsNotReported() throws Exception {
        appointment("+998900000865", "Hours client", "2027-01-04 14:00+05", "2027-01-04 15:00+05", "confirmed");

        putHours(week(block(2, "10:00", "13:00"))).andExpect(status().isOk());
    }

    @Test
    void anAppointmentThatAlreadyStartedIsNotReported() throws Exception {
        appointment("+998900000865", "Hours client", "2026-11-02 10:00+05", "2026-11-02 11:00+05", "confirmed");

        putHours(week(block(2, "10:00", "13:00"))).andExpect(status().isOk());
    }

    @Test
    void aCancelledAppointmentIsNotReported() throws Exception {
        appointment("+998900000865", "Hours client", TUESDAY_APPOINTMENT_START, TUESDAY_APPOINTMENT_END,
                "cancelled");

        putHours(week(block(2, "10:00", "13:00"))).andExpect(status().isOk());
    }

    @Test
    void theMastersTimeZoneDecidesTheLocalDay() throws Exception {
        jdbc.update("update settings set time_zone = 'America/New_York'");
        appointment("+998900000866", "Hours client", "2026-11-03 21:00-05", "2026-11-03 22:00-05", "confirmed");

        putHours(week(block(2, "21:00", "23:00"))).andExpect(status().isOk());
        putHours(week(block(2, "10:00", "13:00"))).andExpect(status().isConflict());
    }

    @Test
    void invalidHoursAreRefusedBeforeConflictsAreChecked() throws Exception {
        tuesdayAppointment();

        putHours(week(block(2, "13:00", "09:00")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("block must start before it ends"));
    }
}
