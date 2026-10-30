package com.massagedesk.api.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class AppointmentEnumConvertersTests {

    private final AppointmentStatusConverter status = new AppointmentStatusConverter();
    private final AppointmentSourceConverter source = new AppointmentSourceConverter();

    @Test
    void everyStatusRoundTrips() {
        for (AppointmentStatus value : AppointmentStatus.values()) {
            assertThat(status.convertToEntityAttribute(status.convertToDatabaseColumn(value))).isEqualTo(value);
        }
    }

    @Test
    void everySourceRoundTrips() {
        for (AppointmentSource value : AppointmentSource.values()) {
            assertThat(source.convertToEntityAttribute(source.convertToDatabaseColumn(value))).isEqualTo(value);
        }
    }

    @Test
    void usesLowercaseDatabaseValues() {
        assertThat(status.convertToDatabaseColumn(AppointmentStatus.NO_SHOW)).isEqualTo("no_show");
        assertThat(source.convertToDatabaseColumn(AppointmentSource.MANUAL)).isEqualTo("manual");
    }

    @Test
    void rejectsUnknownValue() {
        assertThatThrownBy(() -> status.convertToEntityAttribute("pending"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> source.convertToEntityAttribute("pending"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void nullStaysNull() {
        assertThat(status.convertToDatabaseColumn(null)).isNull();
        assertThat(status.convertToEntityAttribute(null)).isNull();
        assertThat(source.convertToDatabaseColumn(null)).isNull();
        assertThat(source.convertToEntityAttribute(null)).isNull();
    }
}
