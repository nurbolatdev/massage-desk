package com.massagedesk.api.messaging;

/** Values of {@code webhook_logs.status}. */
public enum WebhookStatus {
    RECEIVED,
    PROCESSED,
    DUPLICATE,
    REJECTED,
    FAILED
}
