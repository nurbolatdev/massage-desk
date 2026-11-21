package com.massagedesk.api.messaging;

import java.time.Clock;
import java.util.Locale;
import java.util.Objects;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Records incoming WhatsApp webhook delivery attempts in {@code webhook_logs}.
 * Signed deliveries are logged with their JSON object payload; refused ones are logged without it.
 * Signed deliveries are then processed in their own transaction: {@code processed}, {@code duplicate} when
 * every message of the delivery was already stored, or {@code failed} with the exception class name in
 * {@code error} (payload kept for replay).
 * Each row is saved on its own (no outer transaction), so a refused delivery is persisted even when nothing else runs.
 *
 * <p>Error codes written to {@code webhook_logs.error}:
 * <ul>
 *   <li>{@code app_secret_not_set} — {@code WHATSAPP_APP_SECRET} is empty, so no signature can be verified;
 *   <li>{@code missing_signature} — header {@code X-Hub-Signature-256} is absent or blank;
 *   <li>{@code invalid_signature} — header is malformed or does not match the body HMAC-SHA256;
 *   <li>{@code body_too_large} — request body exceeds the 3 MiB webhook limit;
 *   <li>{@code invalid_json} — signed body is not a valid JSON object;
 *   <li>{@code nul_character} — signed JSON contains {@code \u0000}, which PostgreSQL {@code jsonb} cannot store.
 * </ul>
 */
@Service
class WebhookDeliveries {

    enum Rejection {
        APP_SECRET_NOT_SET,
        MISSING_SIGNATURE,
        INVALID_SIGNATURE,
        BODY_TOO_LARGE;

        String code() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    enum Failure {
        INVALID_JSON("invalid_json"),
        NUL_CHARACTER("nul_character");

        private final String code;

        Failure(String code) {
            this.code = code;
        }

        String code() {
            return code;
        }
    }

    private final WebhookLogRepository logs;
    private final JsonMapper jsonMapper;
    private final InboundMessages inbound;
    private final Clock clock;

    WebhookDeliveries(
            WebhookLogRepository logs,
            JsonMapper jsonMapper,
            InboundMessages inbound,
            Clock clock) {
        this.logs = logs;
        this.jsonMapper = jsonMapper;
        this.inbound = inbound;
        this.clock = clock;
    }

    void reject(Rejection reason) {
        Objects.requireNonNull(reason, "reason");
        logs.save(WebhookLog.rejected(reason.code()));
    }

    void accept(byte[] body) {
        Objects.requireNonNull(body, "body");
        JsonNode tree;
        try {
            tree = jsonMapper.readTree(body);
        } catch (JacksonException e) {
            tree = null;
        }
        if (tree == null || !tree.isObject()) {
            logs.save(WebhookLog.failed(Failure.INVALID_JSON.code()));
            return;
        }
        String json = jsonMapper.writeValueAsString(tree);
        if (json.contains("\\u0000")) {
            logs.save(WebhookLog.failed(Failure.NUL_CHARACTER.code()));
            return;
        }
        WebhookLog log = logs.save(WebhookLog.received(json));
        try {
            InboundMessages.Stored stored = inbound.store(WebhookPayload.messages(tree));
            if (stored.isDuplicate()) {
                log.markDuplicate(clock.instant());
            } else {
                log.markProcessed(clock.instant());
            }
        } catch (RuntimeException e) {
            log.markFailed(e.getClass().getName(), clock.instant());
        }
        logs.save(log);
    }
}
