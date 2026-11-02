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

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"timeZone\":\"Mars/Base\"}",
            "{\"timeZone\":\"+05:00\"}",
            "{\"timeZone\":\"UTC\"}",
            "{\"timeZone\":\"Etc/GMT+5\"}",
            "{\"timeZone\":\"Etc/GMT-5\"}",
            "{\"timeZone\":\"\"}",
            "{\"botEnabled\":\"maybe\"}",
            "{not json"})
    void refusesInvalidInput(String json) throws Exception {
        patchSettings(json)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void unknownZoneHasAClearDetail() throws Exception {
        patchSettings("{\"timeZone\":\"Mars/Base\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("unknown time zone"));
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
