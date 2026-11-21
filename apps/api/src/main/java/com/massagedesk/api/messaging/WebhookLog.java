package com.massagedesk.api.messaging;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

/**
 * One row per webhook delivery; append-only, written by the API.
 * Refused deliveries store {@code payload = null} and the machine error reason in {@code error}.
 */
@Entity
@Table(name = "webhook_logs")
public class WebhookLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "signature_valid", nullable = false, updatable = false)
    private boolean signatureValid;

    @Convert(converter = WebhookStatusConverter.class)
    @Column(name = "status", nullable = false)
    private WebhookStatus status;

    @Column(name = "error")
    private String error;

    @Column(name = "payload", columnDefinition = "jsonb", updatable = false)
    @ColumnTransformer(write = "cast(? as jsonb)")
    private String payload;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected WebhookLog() {
    }

    private WebhookLog(boolean signatureValid, WebhookStatus status, String error, String payload) {
        this.signatureValid = signatureValid;
        this.status = Objects.requireNonNull(status, "status");
        this.error = error;
        this.payload = payload;
    }

    static WebhookLog received(String payload) {
        return new WebhookLog(true, WebhookStatus.RECEIVED, null, Objects.requireNonNull(payload, "payload"));
    }

    static WebhookLog failed(String error) {
        return new WebhookLog(true, WebhookStatus.FAILED, Objects.requireNonNull(error, "error"), null);
    }

    static WebhookLog rejected(String error) {
        return new WebhookLog(false, WebhookStatus.REJECTED, Objects.requireNonNull(error, "error"), null);
    }

    void markProcessed(Instant at) {
        Objects.requireNonNull(at, "at");
        requireReceived();
        this.status = WebhookStatus.PROCESSED;
        this.processedAt = at;
    }

    void markDuplicate(Instant at) {
        Objects.requireNonNull(at, "at");
        requireReceived();
        this.status = WebhookStatus.DUPLICATE;
        this.processedAt = at;
    }

    void markFailed(String error, Instant at) {
        Objects.requireNonNull(error, "error");
        Objects.requireNonNull(at, "at");
        requireReceived();
        this.status = WebhookStatus.FAILED;
        this.error = error;
        this.processedAt = at;
    }

    private void requireReceived() {
        if (this.status != WebhookStatus.RECEIVED) {
            throw new IllegalStateException("Expected RECEIVED status, got " + this.status);
        }
    }

    public UUID getId() {
        return id;
    }

    public boolean isSignatureValid() {
        return signatureValid;
    }

    public WebhookStatus getStatus() {
        return status;
    }

    public String getError() {
        return error;
    }

    public String getPayload() {
        return payload;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
