package com.massagedesk.api.booking;

import com.massagedesk.api.persistence.LowercaseEnumConverter;
import jakarta.persistence.Converter;

/** Maps {@link AppointmentStatus} to its lowercase database value. */
@Converter
public class AppointmentStatusConverter extends LowercaseEnumConverter<AppointmentStatus> {

    public AppointmentStatusConverter() {
        super(AppointmentStatus.class);
    }
}
