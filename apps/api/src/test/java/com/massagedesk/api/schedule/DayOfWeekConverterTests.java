package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import org.junit.jupiter.api.Test;

class DayOfWeekConverterTests {

    private final DayOfWeekConverter converter = new DayOfWeekConverter();

    @Test
    void mondayIsOneAndSundayIsSeven() {
        assertThat(converter.convertToDatabaseColumn(DayOfWeek.MONDAY)).isEqualTo(1);
        assertThat(converter.convertToDatabaseColumn(DayOfWeek.SUNDAY)).isEqualTo(7);
        assertThat(converter.convertToEntityAttribute(1)).isEqualTo(DayOfWeek.MONDAY);
        assertThat(converter.convertToEntityAttribute(7)).isEqualTo(DayOfWeek.SUNDAY);
    }

    @Test
    void nullStaysNull() {
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
        assertThat(converter.convertToEntityAttribute(null)).isNull();
    }
}
