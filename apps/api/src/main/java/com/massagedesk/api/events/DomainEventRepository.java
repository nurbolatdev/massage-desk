package com.massagedesk.api.events;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DomainEventRepository extends JpaRepository<DomainEvent, UUID> {
}
