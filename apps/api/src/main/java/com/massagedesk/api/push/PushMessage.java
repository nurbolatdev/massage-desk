package com.massagedesk.api.push;

import java.util.Map;
import org.jspecify.annotations.Nullable;

/**
 * Notification payload sent to registered staff devices.
 *
 * @param title short heading shown on the notification
 * @param body notification text shown below the title
 * @param data key-value string payload passed to the mobile app on tap; omitted from JSON when empty
 * @param channelId Android notification channel id; omitted from JSON when {@code null}
 */
public record PushMessage(
        String title,
        String body,
        Map<String, String> data,
        @Nullable String channelId) {

    public PushMessage {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title must not be blank");
        }
        if (body == null || body.isBlank()) {
            throw new IllegalArgumentException("body must not be blank");
        }
        if (data == null || data.isEmpty()) {
            data = Map.of();
        } else {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                if (entry.getKey() == null || entry.getValue() == null) {
                    throw new IllegalArgumentException("data must not contain null keys or values");
                }
            }
            data = Map.copyOf(data);
        }
        if (channelId != null && channelId.isBlank()) {
            throw new IllegalArgumentException("channelId must not be blank");
        }
    }
}
