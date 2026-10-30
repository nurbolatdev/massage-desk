package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class ScheduleRepositoriesTests {

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    @Autowired
    private TimeOffRepository timeOff;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void listsOnlyActiveServicesInOrder() {
        MassageService second = new MassageService("Classic", 60, new BigDecimal("150000.50"), 2);
        MassageService first = new MassageService("Back", 30, new BigDecimal("90000.00"), 1);
        MassageService inactive = new MassageService("Old", 45, new BigDecimal("1.00"), 0);
        services.saveAndFlush(second);
        services.saveAndFlush(first);
        services.saveAndFlush(inactive);
        jdbc.update("update services set active = false where id = ?", inactive.getId());
        entityManager.clear();

        List<MassageService> found = services.findByActiveTrueOrderBySortOrderAscNameAsc();

        assertThat(found).extracting(MassageService::getName).containsExactly("Back", "Classic");
        assertThat(found.get(1).getPrice()).isEqualByComparingTo("150000.50");
    }

    @Test
    void findsWorkingHoursOfOneDayInTimeOrder() {
        WorkingHours afternoon = new WorkingHours(DayOfWeek.MONDAY, LocalTime.of(14, 0), LocalTime.of(18, 0));
        WorkingHours morning = new WorkingHours(DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(13, 0));
        WorkingHours tuesday = new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(9, 0), LocalTime.of(13, 0));
        workingHours.saveAndFlush(afternoon);
        workingHours.saveAndFlush(morning);
        workingHours.saveAndFlush(tuesday);
        entityManager.clear();

        List<WorkingHours> monday = workingHours.findByWeekdayOrderByStartTimeAsc(DayOfWeek.MONDAY);

        assertThat(monday).extracting(WorkingHours::getStartTime)
                .containsExactly(LocalTime.of(9, 0), LocalTime.of(14, 0));
        Integer stored = jdbc.queryForObject(
                "select weekday from working_hours where id = ?", Integer.class, morning.getId());
        assertThat(stored).isEqualTo(1);
    }

    @Test
    void timeOffPeriodRoundTripsAsHalfOpenRange() {
        Instant start = Instant.parse("2026-11-02T05:00:00Z");
        TimeRange range = new TimeRange(start, Instant.parse("2026-11-02T06:00:00Z"));
        TimeOff saved = timeOff.saveAndFlush(new TimeOff(range, "Lunch"));
        entityManager.clear();

        TimeOff found = timeOff.findById(saved.getId()).orElseThrow();

        assertThat(found.getPeriod()).isEqualTo(range);
        Boolean lowerInclusive = jdbc.queryForObject(
                "select lower_inc(period) from time_off where id = ?", Boolean.class, saved.getId());
        Boolean upperInclusive = jdbc.queryForObject(
                "select upper_inc(period) from time_off where id = ?", Boolean.class, saved.getId());
        Boolean lowerMatches = jdbc.queryForObject(
                "select lower(period) = ?::timestamptz from time_off where id = ?",
                Boolean.class, start.toString(), saved.getId());
        assertThat(lowerInclusive).isTrue();
        assertThat(upperInclusive).isFalse();
        assertThat(lowerMatches).isTrue();
    }

    @Test
    void readsTimeOffInsertedWithSqlOffsets() {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into time_off (id, period, reason)
                values (?, tstzrange('2026-11-02 10:00+05', '2026-11-02 18:00+05'), 'Trip')
                """, id);
        entityManager.clear();

        TimeOff found = timeOff.findById(id).orElseThrow();

        assertThat(found.getPeriod()).isEqualTo(new TimeRange(
                Instant.parse("2026-11-02T05:00:00Z"), Instant.parse("2026-11-02T13:00:00Z")));
    }
}
