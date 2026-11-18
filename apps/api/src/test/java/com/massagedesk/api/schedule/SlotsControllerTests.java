package com.massagedesk.api.schedule;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class SlotsControllerTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private JdbcTemplate jdbc;

    private MassageService classic;
    private Client client;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from working_hours");
        classic = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
        client = clients.saveAndFlush(new Client("+998900000301", "Slots client"));
    }

    private void block(DayOfWeek weekday, int fromHour, int toHour) {
        workingHours.saveAndFlush(new WorkingHours(weekday, LocalTime.of(fromHour, 0), LocalTime.of(toHour, 0)));
    }

    private void timeOff(String start, String end) {
        jdbc.update("""
                insert into time_off (id, period, reason)
                values (?, tstzrange(?::timestamptz, ?::timestamptz), 'Test')
                """, UUID.randomUUID(), start, end);
    }

    private void appointment(String start, String end, String status) {
        jdbc.update("""
                insert into appointments (id, client_id, service_id, period, status)
                values (?, ?, ?, tstzrange(?::timestamptz, ?::timestamptz), ?)
                """, UUID.randomUUID(), client.getId(), classic.getId(), start, end, status);
    }

    private ResultActions getSlots(String serviceId, String day, StaffRole role) throws Exception {
        var request = get("/slots").param("serviceId", serviceId);
        if (day != null) {
            request = request.param("day", day);
        }
        return mvc.perform(request.with(jwt().authorities(new SimpleGrantedAuthority(role.authority()))));
    }

    private ResultActions getSlots(String day) throws Exception {
        return getSlots(classic.getId().toString(), day, StaffRole.MASTER);
    }

    @Test
    void returnsFreeStartsWithMasterOffset() throws Exception {
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(12, 0)));

        mvc.perform(get("/slots")
                        .param("serviceId", classic.getId().toString())
                        .param("day", "2026-11-03")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.day").value("2026-11-03"))
                .andExpect(jsonPath("$.timeZone").value("Asia/Tashkent"))
                .andExpect(jsonPath("$.durationMin").value(60))
                .andExpect(jsonPath("$.starts", contains(
                        "2026-11-03T10:00:00+05:00",
                        "2026-11-03T10:30:00+05:00",
                        "2026-11-03T11:00:00+05:00")));
    }

    @Test
    void requiresToken() throws Exception {
        mvc.perform(get("/slots")
                        .param("serviceId", classic.getId().toString())
                        .param("day", "2026-11-03"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsInvalidDay() throws Exception {
        mvc.perform(get("/slots")
                        .param("serviceId", classic.getId().toString())
                        .param("day", "2026-13-40")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void unknownServiceIsNotFound() throws Exception {
        mvc.perform(get("/slots")
                        .param("serviceId", UUID.randomUUID().toString())
                        .param("day", "2026-11-03")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("service not found"));
    }

    @Test
    void breakBetweenBlocksIsNotOffered() throws Exception {
        block(DayOfWeek.TUESDAY, 10, 12);
        block(DayOfWeek.TUESDAY, 13, 15);

        getSlots("2026-11-03").andExpect(status().isOk()).andExpect(jsonPath("$.starts", contains(
                "2026-11-03T10:00:00+05:00", "2026-11-03T10:30:00+05:00", "2026-11-03T11:00:00+05:00",
                "2026-11-03T13:00:00+05:00", "2026-11-03T13:30:00+05:00", "2026-11-03T14:00:00+05:00")));
    }

    @Test
    void wholeDayTimeOffLeavesNoStarts() throws Exception {
        block(DayOfWeek.TUESDAY, 10, 12);
        timeOff("2026-11-03 00:00+05", "2026-11-04 00:00+05");

        getSlots("2026-11-03").andExpect(status().isOk()).andExpect(jsonPath("$.starts", empty()));
    }

    @Test
    void vacationStartedEarlierBlocksMorning() throws Exception {
        block(DayOfWeek.TUESDAY, 10, 12);
        timeOff("2026-11-01 00:00+05", "2026-11-03 11:00+05");

        getSlots("2026-11-03").andExpect(status().isOk())
                .andExpect(jsonPath("$.starts", contains("2026-11-03T11:00:00+05:00")));
    }

    @Test
    void partialTimeOffBlocksOverlappingStarts() throws Exception {
        block(DayOfWeek.TUESDAY, 10, 12);
        timeOff("2026-11-03 10:30+05", "2026-11-03 11:00+05");

        getSlots("2026-11-03").andExpect(status().isOk())
                .andExpect(jsonPath("$.starts", contains("2026-11-03T11:00:00+05:00")));
    }

    @Test
    void confirmedAppointmentBlocksTime() throws Exception {
        block(DayOfWeek.TUESDAY, 10, 12);
        appointment("2026-11-03 10:00+05", "2026-11-03 11:00+05", "confirmed");

        getSlots("2026-11-03").andExpect(status().isOk())
                .andExpect(jsonPath("$.starts", contains("2026-11-03T11:00:00+05:00")));
    }

    @Test
    void cancelledNoShowAndDoneDoNotBlock() throws Exception {
        block(DayOfWeek.TUESDAY, 10, 12);
        appointment("2026-11-03 10:00+05", "2026-11-03 11:00+05", "cancelled");
        appointment("2026-11-03 10:00+05", "2026-11-03 11:00+05", "no_show");
        appointment("2026-11-03 10:00+05", "2026-11-03 11:00+05", "done");

        getSlots("2026-11-03").andExpect(status().isOk()).andExpect(jsonPath("$.starts", contains(
                "2026-11-03T10:00:00+05:00", "2026-11-03T10:30:00+05:00", "2026-11-03T11:00:00+05:00")));
    }

    @Test
    void appointmentAcrossMidnightBlocksStartOfDay() throws Exception {
        block(DayOfWeek.TUESDAY, 0, 2);
        appointment("2026-11-02 23:30+05", "2026-11-03 00:30+05", "confirmed");

        getSlots("2026-11-03").andExpect(status().isOk()).andExpect(jsonPath("$.starts", contains(
                "2026-11-03T00:30:00+05:00", "2026-11-03T01:00:00+05:00")));
    }

    @Test
    void usesTimeZoneFromSettings() throws Exception {
        jdbc.update("update settings set time_zone = ?", "America/New_York");
        block(DayOfWeek.TUESDAY, 21, 23);
        appointment("2026-11-04T02:00:00Z", "2026-11-04T03:00:00Z", "confirmed");

        getSlots("2026-11-03").andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("America/New_York"))
                .andExpect(jsonPath("$.starts", contains("2026-11-03T22:00:00-05:00")));
    }

    @Test
    void daylightSavingDayUsesSummerOffset() throws Exception {
        jdbc.update("update settings set time_zone = ?", "America/New_York");
        block(DayOfWeek.SUNDAY, 9, 10);

        getSlots("2027-03-14").andExpect(status().isOk())
                .andExpect(jsonPath("$.starts", contains("2027-03-14T09:00:00-04:00")));
    }

    @Test
    void dayWithoutWorkingHoursIsEmpty() throws Exception {
        block(DayOfWeek.TUESDAY, 10, 12);

        getSlots("2026-11-04").andExpect(status().isOk()).andExpect(jsonPath("$.starts", empty()));
    }

    @Test
    void pastDayIsEmpty() throws Exception {
        block(DayOfWeek.SUNDAY, 10, 12);

        getSlots("2026-11-01").andExpect(status().isOk()).andExpect(jsonPath("$.starts", empty()));
    }

    @Test
    void missingDayIsBadRequest() throws Exception {
        getSlots(classic.getId().toString(), null, StaffRole.MASTER)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void invalidServiceIdIsBadRequest() throws Exception {
        getSlots("abc", "2026-11-03", StaffRole.MASTER)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void inactiveServiceIsNotFound() throws Exception {
        jdbc.update("update services set active = false where id = ?", classic.getId());

        getSlots("2026-11-03").andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("service not found"));
    }

    @Test
    void adminCanReadSlots() throws Exception {
        block(DayOfWeek.TUESDAY, 10, 11);

        getSlots(classic.getId().toString(), "2026-11-03", StaffRole.ADMIN)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.starts", contains(
                        "2026-11-03T10:00:00+05:00")));
    }
}
