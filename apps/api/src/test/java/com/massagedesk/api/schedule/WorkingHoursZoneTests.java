package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.security.StaffRole;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.transaction.annotation.Transactional;

/**
 * Working hours are local wall-clock times: the stored {@code time} values must be exactly what the
 * API received, whatever the time zone of the JVM is. The build pins the test JVM to a non-UTC zone
 * so a regression shows up here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class WorkingHoursZoneTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clearHours() {
        jdbc.update("delete from working_hours");
    }

    private ResultActions putHours(String json) throws Exception {
        return mvc.perform(put("/working-hours").contentType(MediaType.APPLICATION_JSON).content(json)
                .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))));
    }

    private static String block(int weekday, String start, String end) {
        return "{\"weekday\":" + weekday + ",\"start\":\"" + start + "\",\"end\":\"" + end + "\"}";
    }

    @Test
    void testJvmRunsInANonUtcZone() {
        assertThat(TimeZone.getDefault().getRawOffset()).isNotZero();
    }

    @Test
    void putStoresTheLocalTimesAsGiven() throws Exception {
        putHours("{\"blocks\":[" + block(2, "10:00", "19:00") + "]}").andExpect(status().isOk());

        List<Map<String, Object>> rows =
                jdbc.queryForList("select start_time::text as s, end_time::text as e from working_hours");
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)).containsEntry("s", "10:00:00").containsEntry("e", "19:00:00");
    }

    @Test
    void rawRowsAreReadBackAsLocalTimes() throws Exception {
        jdbc.update("insert into working_hours (weekday, start_time, end_time) values (2, '15:00', '19:00')");

        mvc.perform(get("/working-hours")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocks.length()").value(1))
                .andExpect(jsonPath("$.blocks[0].start").value("15:00"))
                .andExpect(jsonPath("$.blocks[0].end").value("19:00"));
    }

    @Test
    void earlyMorningBlockRoundTrips() throws Exception {
        putHours("{\"blocks\":[" + block(2, "03:00", "06:00") + "]}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocks[0].start").value("03:00"))
                .andExpect(jsonPath("$.blocks[0].end").value("06:00"));

        mvc.perform(get("/working-hours")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))))
                .andExpect(jsonPath("$.blocks[0].start").value("03:00"))
                .andExpect(jsonPath("$.blocks[0].end").value("06:00"));
    }
}
