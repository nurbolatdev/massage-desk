package com.massagedesk.api.schedule;

import static org.hamcrest.Matchers.contains;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
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
    private JdbcTemplate jdbc;

    private MassageService classic;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from working_hours");
        classic = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
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
}
