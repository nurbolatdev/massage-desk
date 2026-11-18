package com.massagedesk.api.security;

import com.massagedesk.api.persistence.LowercaseEnumConverter;
import jakarta.persistence.Converter;

/** Maps {@link StaffRole} to its lowercase database value. */
@Converter
public class StaffRoleConverter extends LowercaseEnumConverter<StaffRole> {

    public StaffRoleConverter() {
        super(StaffRole.class);
    }
}
