package com.massagedesk.api.events;

import com.massagedesk.api.persistence.LowercaseEnumConverter;
import jakarta.persistence.Converter;

/** Maps {@link DomainEventType} to its lowercase database value. */
@Converter
public class DomainEventTypeConverter extends LowercaseEnumConverter<DomainEventType> {

    public DomainEventTypeConverter() {
        super(DomainEventType.class);
    }
}
