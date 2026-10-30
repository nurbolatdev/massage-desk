package com.massagedesk.api.events;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes domain events. Joins the caller's transaction and refuses to run without one, so the event
 * is committed or rolled back together with the change it describes.
 *
 * <p>Payload conventions: snake_case keys, times as ISO-8601 strings, no personal data.
 *
 * <p>The returned event has its id; {@code createdAt} is filled in only after the persistence context
 * is flushed.
 */
@Service
public class DomainEventRecorder {

    private final DomainEventRepository repository;
    private final JsonMapper jsonMapper;

    public DomainEventRecorder(DomainEventRepository repository, JsonMapper jsonMapper) {
        this.repository = repository;
        this.jsonMapper = jsonMapper;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public DomainEvent record(DomainEventType type, UUID entityId, EventActor actor, Map<String, ?> payload) {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(entityId, "entityId");
        Objects.requireNonNull(actor, "actor");
        Objects.requireNonNull(payload, "payload");
        String json = jsonMapper.writeValueAsString(payload);
        return repository.save(new DomainEvent(type, entityId, actor, json));
    }
}
