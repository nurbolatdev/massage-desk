package com.massagedesk.api.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import java.time.ZoneId;
import java.time.LocalTime;
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
class SettingsControllerTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    @Autowired
    private ClientRepository clients;

    @BeforeEach
    void clearHours() {
        jdbc.update("delete from working_hours");
    }

    private ResultActions getSettings() throws Exception {
        return mvc.perform(get("/settings")
                .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))));
    }

    private ResultActions patchSettings(String json, StaffRole role) throws Exception {
        return mvc.perform(patch("/settings").contentType(MediaType.APPLICATION_JSON).content(json)
                .with(jwt().authorities(new SimpleGrantedAuthority(role.authority()))));
    }

    private ResultActions patchSettings(String json) throws Exception {
        return patchSettings(json, StaffRole.MASTER);
    }

    @Test
    void returnsTheDefaults() throws Exception {
        getSettings()
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.timeZone").value("Asia/Tashkent"))
                .andExpect(jsonPath("$.address").value((Object) null))
                .andExpect(jsonPath("$.botEnabled").value(true));
    }

    @Test
    void changesAddressAndBotSwitch() throws Exception {
        patchSettings("{\"address\":\"  Navoi 12  \",\"botEnabled\":false}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("Asia/Tashkent"))
                .andExpect(jsonPath("$.address").value("Navoi 12"))
                .andExpect(jsonPath("$.botEnabled").value(false));
        getSettings()
                .andExpect(jsonPath("$.address").value("Navoi 12"))
                .andExpect(jsonPath("$.botEnabled").value(false));
    }

    @Test
    void blankAddressClearsIt() throws Exception {
        patchSettings("{\"address\":\"Navoi 12\"}").andExpect(status().isOk());
        patchSettings("{\"address\":\"   \"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address").value((Object) null));
    }

    @Test
    void emptyPatchChangesNothing() throws Exception {
        patchSettings("{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("Asia/Tashkent"))
                .andExpect(jsonPath("$.botEnabled").value(true));
    }

    @Test
    void timeZoneReachesFreeTime() throws Exception {
        MassageService service = services.saveAndFlush(
                new MassageService("Zone test", 60, new BigDecimal("100000.00"), 900));
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(21, 0), LocalTime.of(23, 0)));

        patchSettings("{\"timeZone\":\"America/New_York\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("America/New_York"));

        mvc.perform(get("/slots").param("serviceId", service.getId().toString()).param("day", "2026-11-03")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("America/New_York"))
                .andExpect(jsonPath("$.starts", contains(
                        "2026-11-03T21:00:00-05:00",
                        "2026-11-03T21:30:00-05:00",
                        "2026-11-03T22:00:00-05:00")));
    }

    private static final String ZONE_PHONE = "+998900000881";

    private void tuesdayHours() {
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)));
    }

    private UUID zoneAppointment(String phone, String start, String end, String status) {
        Client client = clients.saveAndFlush(new Client(phone, "Zone client"));
        MassageService service = services.saveAndFlush(
                new MassageService("Zone conflict service", 60, new BigDecimal("1000.00"), 1));
        return jdbc.queryForObject("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange(cast(? as timestamptz), cast(? as timestamptz)), ?)
                returning id
                """, UUID.class, client.getId(), service.getId(), start, end, status);
    }

    private UUID tuesdayZoneAppointment() {
        tuesdayHours();
        return zoneAppointment(ZONE_PHONE, "2026-11-03 14:00+05", "2026-11-03 15:00+05", "confirmed");
    }

    @Test
    void aZoneThatLeavesAnAppointmentOutAsksForConfirmation() throws Exception {
        UUID id = tuesdayZoneAppointment();

        patchSettings("{\"timeZone\":\"America/New_York\"}")
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("APPOINTMENT_CONFLICT"))
                .andExpect(jsonPath("$.detail")
                        .value("confirmed appointments are outside the working hours in the new time zone"))
                .andExpect(jsonPath("$.conflicts.length()").value(1))
                .andExpect(jsonPath("$.conflicts[0].appointmentId").value(id.toString()))
                .andExpect(jsonPath("$.conflicts[0].clientName").value("Zone client"))
                .andExpect(jsonPath("$.conflicts[0].start").value("2026-11-03T04:00:00-05:00"))
                .andExpect(jsonPath("$.conflicts[0].end").value("2026-11-03T05:00:00-05:00"))
                .andExpect(jsonPath("$.properties").doesNotExist());
        getSettings().andExpect(jsonPath("$.timeZone").value("Asia/Tashkent"));
    }

    @Test
    void forceFalseStillAsksForConfirmation() throws Exception {
        tuesdayZoneAppointment();

        patchSettings("{\"timeZone\":\"America/New_York\",\"force\":false}")
                .andExpect(status().isConflict());
    }

    @Test
    void forceStoresTheZoneAndKeepsTheAppointment() throws Exception {
        UUID id = tuesdayZoneAppointment();

        patchSettings("{\"timeZone\":\"America/New_York\",\"force\":true}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("America/New_York"));

        Integer kept = jdbc.queryForObject("""
                select count(*) from appointments where id = ? and status = 'confirmed'
                  and lower(period) = cast('2026-11-03 14:00+05' as timestamptz)
                  and upper(period) = cast('2026-11-03 15:00+05' as timestamptz)
                """, Integer.class, id);
        assertThat(kept).isEqualTo(1);
    }

    @Test
    void aZoneWithTheSameOffsetIsStored() throws Exception {
        tuesdayZoneAppointment();

        patchSettings("{\"timeZone\":\"Asia/Samarkand\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("Asia/Samarkand"));
    }

    @Test
    void theSameZoneIsNotChecked() throws Exception {
        zoneAppointment(ZONE_PHONE, "2026-11-03 14:00+05", "2026-11-03 15:00+05", "confirmed");

        patchSettings("{\"timeZone\":\"Asia/Tashkent\"}").andExpect(status().isOk());
        patchSettings("{\"timeZone\":\"Asia/Samarkand\"}").andExpect(status().isConflict());
    }

    @Test
    void anAppointmentAYearAheadIsReported() throws Exception {
        tuesdayHours();
        UUID id = zoneAppointment(ZONE_PHONE, "2027-11-02 14:00+05", "2027-11-02 15:00+05", "confirmed");

        patchSettings("{\"timeZone\":\"America/New_York\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.conflicts[0].appointmentId").value(id.toString()));
    }

    @Test
    void anAppointmentThatAlreadyStartedIsNotChecked() throws Exception {
        tuesdayHours();
        zoneAppointment(ZONE_PHONE, "2026-11-02 10:00+05", "2026-11-02 11:00+05", "confirmed");

        patchSettings("{\"timeZone\":\"America/New_York\"}").andExpect(status().isOk());
    }

    @Test
    void aCancelledAppointmentIsNotChecked() throws Exception {
        tuesdayHours();
        zoneAppointment(ZONE_PHONE, "2026-11-03 14:00+05", "2026-11-03 15:00+05", "cancelled");

        patchSettings("{\"timeZone\":\"America/New_York\"}").andExpect(status().isOk());
    }

    @Test
    void anUnknownZoneWinsOverTheConflict() throws Exception {
        tuesdayZoneAppointment();

        patchSettings("{\"timeZone\":\"Mars/Base\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNKNOWN_TIME_ZONE"));
    }

    @Test
    void anAddressChangeIsNotChecked() throws Exception {
        tuesdayZoneAppointment();

        patchSettings("{\"address\":\"Navoi 12\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address").value("Navoi 12"));
    }

    @Test
    void aRefusedChangeStoresNothingOfTheRequest() throws Exception {
        tuesdayZoneAppointment();

        patchSettings("{\"timeZone\":\"America/New_York\",\"address\":\"Navoi 12\",\"botEnabled\":false}")
                .andExpect(status().isConflict());
        getSettings()
                .andExpect(jsonPath("$.timeZone").value("Asia/Tashkent"))
                .andExpect(jsonPath("$.address").value((Object) null))
                .andExpect(jsonPath("$.botEnabled").value(true));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"timeZone\":\"Mars/Base\"}",
            "{\"timeZone\":\"+05:00\"}",
            "{\"timeZone\":\"\"}",
            "{\"botEnabled\":\"maybe\"}",
            "{not json"})
    void refusesInvalidInput(String json) throws Exception {
        patchSettings(json)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"UTC", "Etc/GMT+5", "Etc/GMT-5"})
    void fixedOffsetZonesAreRefused(String id) throws Exception {
        assertThat(ZoneId.getAvailableZoneIds()).contains(id);
        assertThat(ZoneId.of(id).getRules().isFixedOffset()).isTrue();

        patchSettings("{\"timeZone\":\"" + id + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("unknown time zone"));
        getSettings().andExpect(jsonPath("$.timeZone").value("Asia/Tashkent"));
    }

    @Test
    void unknownRegionIdIsRefused() throws Exception {
        assertThat(ZoneId.getAvailableZoneIds()).doesNotContain("Mars/Olympus");

        patchSettings("{\"timeZone\":\"Mars/Olympus\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("unknown time zone"));
        getSettings().andExpect(jsonPath("$.timeZone").value("Asia/Tashkent"));
    }

    @Test
    void refusesALongAddress() throws Exception {
        patchSettings("{\"address\":\"" + "a".repeat(301) + "\"}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void adminCanChangeSettings() throws Exception {
        patchSettings("{\"botEnabled\":false}", StaffRole.ADMIN)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.botEnabled").value(false));
    }
}
