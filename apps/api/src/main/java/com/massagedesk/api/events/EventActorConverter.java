package com.massagedesk.api.events;

import com.massagedesk.api.persistence.LowercaseEnumConverter;
import jakarta.persistence.Converter;

/** Maps {@link EventActor} to its lowercase database value. */
@Converter
public class EventActorConverter extends LowercaseEnumConverter<EventActor> {

    public EventActorConverter() {
        super(EventActor.class);
    }
}
