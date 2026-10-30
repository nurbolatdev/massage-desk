package com.massagedesk.api.schedule;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimeOffRepository extends JpaRepository<TimeOff, UUID> {
}
