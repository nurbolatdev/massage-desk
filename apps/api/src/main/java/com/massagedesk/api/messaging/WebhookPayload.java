package com.massagedesk.api.messaging;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import tools.jackson.databind.JsonNode;

/**
 * Reads client messages from a WhatsApp Cloud API webhook payload.
 * Tolerant: a malformed message is skipped, not the delivery;
 * statuses and reactions are ignored; only text keeps a body.
 */
final class WebhookPayload {

    static final Set<String> STORED_TYPES = Set.of(
            "text",
            "image",
            "audio",
            "video",
            "document",
            "sticker",
            "location",
            "contacts",
            "interactive",
            "button",
            "unsupported");

    static final int MAX_NAME_LENGTH = 100;

    private static final Pattern TIMESTAMP_DIGITS = Pattern.compile("^[0-9]{1,12}$");
    private static final long MAX_TIMESTAMP_SECONDS = 999_999_999_999L;

    record InboundMessage(
            String waMessageId,
            String waId,
            @Nullable String profileName,
            String type,
            @Nullable String text,
            @Nullable Instant sentAt) {

        InboundMessage {
            Objects.requireNonNull(waMessageId, "waMessageId");
            Objects.requireNonNull(waId, "waId");
            Objects.requireNonNull(type, "type");
        }
    }

    private WebhookPayload() {
    }

    static List<InboundMessage> messages(JsonNode root) {
        if (root == null || !root.isObject()) {
            return List.of();
        }
        List<InboundMessage> result = new ArrayList<>();
        for (JsonNode entry : each(root.path("entry"))) {
            for (JsonNode change : each(entry.path("changes"))) {
                if (!"messages".equals(string(change.path("field")))) {
                    continue;
                }
                JsonNode value = change.path("value");
                Map<String, String> namesByWaId = contactNames(value.path("contacts"));
                for (JsonNode message : each(value.path("messages"))) {
                    String id = nonBlank(message.path("id"));
                    String from = nonBlank(message.path("from"));
                    String type = nonBlank(message.path("type"));
                    if (id == null || from == null || type == null || !STORED_TYPES.contains(type)) {
                        continue;
                    }
                    String text = "text".equals(type) ? string(message.path("text").path("body")) : null;
                    result.add(new InboundMessage(
                            id,
                            from,
                            namesByWaId.get(from),
                            type,
                            text,
                            sentAt(message.path("timestamp"))));
                }
            }
        }
        return List.copyOf(result);
    }

    private static Map<String, String> contactNames(JsonNode contacts) {
        Map<String, String> names = new HashMap<>();
        for (JsonNode contact : each(contacts)) {
            String waId = nonBlank(contact.path("wa_id"));
            String profileName = name(string(contact.path("profile").path("name")));
            if (waId != null && profileName != null) {
                names.put(waId, profileName);
            }
        }
        return names;
    }

    private static Iterable<JsonNode> each(JsonNode node) {
        return node != null && node.isArray() ? node : List.of();
    }

    private static @Nullable String string(JsonNode node) {
        return node != null && node.isString() ? node.asString() : null;
    }

    private static @Nullable String nonBlank(JsonNode node) {
        String raw = string(node);
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static @Nullable String name(@Nullable String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.codePointCount(0, trimmed.length()) <= MAX_NAME_LENGTH) {
            return trimmed;
        }
        int endIndex = trimmed.offsetByCodePoints(0, MAX_NAME_LENGTH);
        return trimmed.substring(0, endIndex);
    }

    private static @Nullable Instant sentAt(JsonNode node) {
        if (node == null) {
            return null;
        }
        long seconds;
        String text = string(node);
        if (text != null) {
            if (!TIMESTAMP_DIGITS.matcher(text).matches()) {
                return null;
            }
            seconds = Long.parseLong(text);
        } else if (node.isIntegralNumber() && node.canConvertToLong()) {
            seconds = node.longValue();
        } else {
            return null;
        }
        return seconds > 0 && seconds <= MAX_TIMESTAMP_SECONDS ? Instant.ofEpochSecond(seconds) : null;
    }
}
