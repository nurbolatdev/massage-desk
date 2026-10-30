package com.massagedesk.api.booking;

import com.massagedesk.api.persistence.LowercaseEnumConverter;
import jakarta.persistence.Converter;

/** Maps {@link AppointmentSource} to its lowercase database value. */
@Converter
public class AppointmentSourceConverter extends LowercaseEnumConverter<AppointmentSource> {

    public AppointmentSourceConverter() {
        super(AppointmentSource.class);
    }
}
