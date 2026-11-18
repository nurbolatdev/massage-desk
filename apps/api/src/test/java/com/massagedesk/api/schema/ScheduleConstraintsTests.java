package com.massagedesk.api.schema;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** The database refuses malformed phones, time off periods and working hour blocks. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class ScheduleConstraintsTests {

    private static final String FROM = "2026-11-03 00:00+05";
    private static final String TO = "2026-11-04 00:00+05";

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clearHours() {
        jdbc.update("delete from working_hours");
    }

    private void client(String phone) {
        jdbc.update("insert into clients (phone) values (?)", phone);
    }

    private void timeOff(String rangeExpression) {
        jdbc.update("insert into time_off (period) values (" + rangeExpression + ")");
    }

    private void block(int weekday, String start, String end) {
        jdbc.update(
                "insert into working_hours (weekday, start_time, end_time) values (?, ?::time, ?::time)",
                weekday, start, end);
    }

    @Test
    void acceptsE164Phone() {
        assertThatCode(() -> client("+998901234567")).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"998901234567", "+12345678", "+1234567890123456"})
    void refusesPhoneOutsideE164(String phone) {
        assertThatThrownBy(() -> client(phone))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("clients_phone_e164");
    }

    @Test
    void acceptsHalfOpenFiniteTimeOff() {
        assertThatCode(() -> timeOff("tstzrange('" + FROM + "'::timestamptz, '" + TO + "'::timestamptz)"))
                .doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "tstzrange('2026-11-03 00:00+05'::timestamptz, '2026-11-04 00:00+05'::timestamptz, '[]')",
        "tstzrange('2026-11-03 00:00+05'::timestamptz, '2026-11-04 00:00+05'::timestamptz, '()')",
        "tstzrange('2026-11-03 00:00+05'::timestamptz, null)",
        "tstzrange(null, '2026-11-04 00:00+05'::timestamptz)",
        "'empty'::tstzrange"
    })
    void refusesUnboundedOrNonHalfOpenTimeOff(String range) {
        assertThatThrownBy(() -> timeOff(range))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("time_off_period_bounded");
    }

    @Test
    void acceptsSeparatedBlocksOfOneDay() {
        block(1, "09:00", "13:00");
        assertThatCode(() -> block(1, "14:00", "18:00")).doesNotThrowAnyException();
    }

    @Test
    void acceptsSameTimesOnDifferentDays() {
        block(1, "09:00", "13:00");
        assertThatCode(() -> block(2, "09:00", "13:00")).doesNotThrowAnyException();
    }

    @Test
    void acceptsMondayAndSundayWithSameTimes() {
        block(1, "09:00", "13:00");
        assertThatCode(() -> block(7, "09:00", "13:00")).doesNotThrowAnyException();
    }

    @Test
    void refusesOverlappingBlocks() {
        block(1, "09:00", "13:00");
        assertThatThrownBy(() -> block(1, "12:00", "15:00"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("working_hours_no_overlap");
    }

    @Test
    void refusesTouchingBlocks() {
        block(1, "09:00", "13:00");
        assertThatThrownBy(() -> block(1, "13:00", "15:00"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("working_hours_no_overlap");
    }
}
