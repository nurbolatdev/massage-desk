package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class TimeRangeConverterTests {

    private final TimeRangeConverter converter = new TimeRangeConverter();

    private static final TimeRange RANGE =
            new TimeRange(Instant.parse("2026-11-02T05:00:00Z"), Instant.parse("2026-11-02T06:00:00Z"));

    @Test
    void writesIsoUtcHalfOpenRange() {
        assertThat(converter.convertToDatabaseColumn(RANGE))
                .isEqualTo("[\"2026-11-02T05:00:00Z\",\"2026-11-02T06:00:00Z\")");
    }

    @Test
    void readsDatabaseTextWithOffset() {
        assertThat(converter.convertToEntityAttribute("[\"2026-11-02 10:00:00+05\",\"2026-11-02 11:00:00+05\")"))
                .isEqualTo(RANGE);
    }

    @Test
    void readsFractionAndHalfHourOffset() {
        assertThat(converter.convertToEntityAttribute("[\"2026-11-02 05:00:00.123456+00\",\"2026-11-02 06:00:00+00\")"))
                .isEqualTo(new TimeRange(
                        Instant.parse("2026-11-02T05:00:00.123456Z"), Instant.parse("2026-11-02T06:00:00Z")));
        assertThat(converter.convertToEntityAttribute("[\"2026-11-02 10:30:00+05:30\",\"2026-11-02 11:30:00+05:30\")"))
                .isEqualTo(RANGE);
    }

    @Test
    void roundTripsThroughDatabaseStyleText() {
        String written = converter.convertToDatabaseColumn(RANGE);
        String dbText = written.replace('T', ' ').replace("Z", "+00");
        assertThat(converter.convertToEntityAttribute(dbText)).isEqualTo(RANGE);
    }

    @Test
    void nullMapsToNull() {
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
        assertThat(converter.convertToEntityAttribute(null)).isNull();
    }

    @Test
    void rejectsUnsupportedForms() {
        assertThatThrownBy(() -> converter.convertToEntityAttribute("empty"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> converter.convertToEntityAttribute(
                        "(\"2026-11-02 10:00:00+05\",\"2026-11-02 11:00:00+05\")"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> converter.convertToEntityAttribute(
                        "[\"2026-11-02 10:00:00+05\",\"2026-11-02 11:00:00+05\"]"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> converter.convertToEntityAttribute("[\"2026-11-02 10:00:00+05\",)"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("2026-11-02 10:00:00+05");
    }

    @Test
    void timeRangeRejectsEmptyAndReversedIntervals() {
        Instant start = Instant.parse("2026-11-02T05:00:00Z");
        assertThatThrownBy(() -> new TimeRange(start, start)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TimeRange(start, start.minusSeconds(1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void timeRangeTruncatesBoundsToMicroseconds() {
        TimeRange range = new TimeRange(
                Instant.parse("2026-11-02T05:00:00.123456789Z"), Instant.parse("2026-11-02T06:00:00.987654321Z"));

        assertThat(range.start()).isEqualTo(Instant.parse("2026-11-02T05:00:00.123456Z"));
        assertThat(range.end()).isEqualTo(Instant.parse("2026-11-02T06:00:00.987654Z"));
    }
}
