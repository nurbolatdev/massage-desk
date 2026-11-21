package com.massagedesk.api.messaging;

import java.util.Locale;
import java.util.Objects;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Records incoming WhatsApp webhook delivery attempts in {@code webhook_logs}.
 * Signed deliveries are logged with their JSON object payload; refused ones are logged without it.
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

    private final WebhookLogRepository logs;
    private final JsonMapper jsonMapper;

    WebhookDeliveries(WebhookLogRepository logs, JsonMapper jsonMapper) {
        this.logs = logs;
        this.jsonMapper = jsonMapper;
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
            logs.save(WebhookLog.failed("invalid_json"));
            return;
        }
        String json = jsonMapper.writeValueAsString(tree);
        if (json.contains("\\u0000")) {
            logs.save(WebhookLog.failed("nul_character"));
            return;
        }
        logs.save(WebhookLog.received(json));
    }
}
