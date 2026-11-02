package com.massagedesk.api.schedule;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates, edits and deactivates the massages the master offers. Services are never deleted. */
@Service
public class ServiceCatalog {

    private final MassageServiceRepository services;

    public ServiceCatalog(MassageServiceRepository services) {
        this.services = services;
    }

    /** Every service, active or not, in display order. */
    @Transactional(readOnly = true)
    public List<MassageService> all() {
        return services.findAllByOrderBySortOrderAscNameAsc();
    }

    /** Adds a service; without a sort order it is appended after the current last one. */
    @Transactional
    public MassageService create(String name, int durationMin, BigDecimal price, Integer sortOrder) {
        int order = sortOrder != null ? sortOrder : services.maxSortOrder() + 1;
        return services.saveAndFlush(new MassageService(name.trim(), durationMin, price, order));
    }

    /** Changes the given fields; {@code null} leaves a field unchanged. */
    @Transactional
    public MassageService update(UUID id, String name, Integer durationMin, BigDecimal price,
            Integer sortOrder, Boolean active) {
        MassageService service = services.findById(id)
                .orElseThrow(() -> new ScheduleException(ScheduleException.Reason.SERVICE_NOT_FOUND,
                        "service not found"));
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
        return services.saveAndFlush(service);
    }
}
