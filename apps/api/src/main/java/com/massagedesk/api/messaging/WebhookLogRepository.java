package com.massagedesk.api.messaging;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebhookLogRepository extends JpaRepository<WebhookLog, UUID> {
}
