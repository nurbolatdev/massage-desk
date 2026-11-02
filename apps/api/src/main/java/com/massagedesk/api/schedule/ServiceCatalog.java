package com.massagedesk.api.schedule;

import com.massagedesk.api.events.Changes;
import com.massagedesk.api.events.DomainEventRecorder;
import com.massagedesk.api.events.DomainEventType;
import com.massagedesk.api.events.EventActor;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates, edits and deactivates the massages the master offers. Services are never deleted. */
@Service
public class ServiceCatalog {

    private final MassageServiceRepository services;
    private final DomainEventRecorder recorder;

    public ServiceCatalog(MassageServiceRepository services, DomainEventRecorder recorder) {
        this.services = services;
        this.recorder = recorder;
    }

    /** Every service, active or not, in display order. */
    @Transactional(readOnly = true)
    public List<MassageService> all() {
        return services.findAllByOrderBySortOrderAscNameAsc();
    }

    /** Adds a service; without a sort order it is appended after the current last one. */
    @Transactional
    public MassageService create(String name, int durationMin, BigDecimal price, Integer sortOrder,
            EventActor actor) {
        int order = sortOrder != null ? sortOrder : services.maxSortOrder() + 1;
        MassageService saved = services.saveAndFlush(new MassageService(name.trim(), durationMin, price, order));
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("name", saved.getName());
        snapshot.put("duration_min", saved.getDurationMin());
        snapshot.put("price", saved.getPrice().toPlainString());
        snapshot.put("sort_order", saved.getSortOrder());
        recorder.record(DomainEventType.SERVICE_CREATED, saved.getId(), actor, snapshot);
        return saved;
    }

    /** Changes the given fields; {@code null} leaves a field unchanged. */
    @Transactional
    public MassageService update(UUID id, String name, Integer durationMin, BigDecimal price,
            Integer sortOrder, Boolean active, EventActor actor) {
        MassageService service = services.findById(id)
                .orElseThrow(() -> new ScheduleException(ScheduleException.Reason.SERVICE_NOT_FOUND,
                        "service not found"));
        String oldName = service.getName();
        int oldDuration = service.getDurationMin();
        BigDecimal oldPrice = service.getPrice();
        int oldOrder = service.getSortOrder();
        boolean wasActive = service.isActive();
        if (name != null) {
            service.rename(name.trim());
        }
        if (durationMin != null) {
            service.changeDuration(durationMin);
        }
        if (price != null) {
            service.changePrice(price);
        }
        if (sortOrder != null) {
            service.moveTo(sortOrder);
        }
        if (active != null) {
            if (active) {
                service.activate();
            } else {
                service.deactivate();
            }
        }
        MassageService saved = services.saveAndFlush(service);
        Changes changes = new Changes()
                .value("name", oldName, saved.getName())
                .value("duration_min", oldDuration, saved.getDurationMin())
                .value("price", oldPrice, saved.getPrice())
                .value("sort_order", oldOrder, saved.getSortOrder())
                .value("active", wasActive, saved.isActive());
        if (!changes.isEmpty()) {
            DomainEventType type = wasActive && !saved.isActive()
                    ? DomainEventType.SERVICE_DEACTIVATED
                    : DomainEventType.SERVICE_UPDATED;
            recorder.record(type, saved.getId(), actor, changes.payload());
        }
        return saved;
    }
}
