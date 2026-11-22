package com.massagedesk.api.messaging;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * Message kinds the WhatsApp Cloud API accepts.
 * Limits are checked before anything is sent;
 * templates are the only kind allowed outside the 24-hour window.
 */
public sealed interface OutboundMessage
        permits OutboundMessage.Text, OutboundMessage.Buttons, OutboundMessage.ListMenu, OutboundMessage.Template {

    record Text(String body) implements OutboundMessage {
        public Text {
            text("text body", body, 4096);
        }
    }

    record Button(String id, String title) {
        public Button {
            text("button id", id, 256);
            text("button title", title, 20);
        }
    }

    record Buttons(String body, List<Button> buttons) implements OutboundMessage {
        public Buttons {
            text("interactive body", body, 1024);
            buttons = copyList("buttons", buttons, 1, 3);
            requireUnique("button id", buttons, Button::id);
            requireUnique("button title", buttons, Button::title);
        }
    }

    record Row(String id, String title, @Nullable String description) {
        public Row {
            text("row id", id, 200);
            text("row title", title, 24);
            if (description != null) {
                text("row description", description, 72);
            }
        }
    }

    record ListMenu(String body, String buttonLabel, List<Row> rows) implements OutboundMessage {
        public ListMenu {
            text("interactive body", body, 1024);
            text("list buttonLabel", buttonLabel, 20);
            rows = copyList("list rows", rows, 1, 10);
            requireUnique("row id", rows, Row::id);
        }
    }

    record Template(String name, String languageCode, List<String> bodyParameters) implements OutboundMessage {
        private static final Pattern NAME_PATTERN = Pattern.compile("^[a-z0-9_]{1,512}$");
        private static final Pattern LANGUAGE_PATTERN = Pattern.compile("^[a-z]{2,3}(_[A-Z]{2})?$");

        public Template {
            if (name == null || !NAME_PATTERN.matcher(name).matches()) {
                throw new IllegalArgumentException("template name must match [a-z0-9_]{1,512}");
            }
            if (languageCode == null || !LANGUAGE_PATTERN.matcher(languageCode).matches()) {
                throw new IllegalArgumentException("template languageCode must match [a-z]{2,3}(_[A-Z]{2})?");
            }
            bodyParameters = copyList("template bodyParameters", bodyParameters, 0, Integer.MAX_VALUE);
            for (String param : bodyParameters) {
                text("template body parameter", param, 1024);
                if (param.indexOf('\n') >= 0 || param.indexOf('\t') >= 0 || param.contains("     ")) {
                    throw new IllegalArgumentException(
                            "template body parameter must not contain newlines, tabs or 5 consecutive spaces");
                }
            }
        }
    }

    private static void text(String field, String value, int maxCodePoints) {
        if (value == null || value.isBlank() || value.codePointCount(0, value.length()) > maxCodePoints) {
            throw new IllegalArgumentException(field + " must be 1.." + maxCodePoints + " characters");
        }
    }

    private static <T> List<T> copyList(String field, List<T> items, int min, int max) {
        if (items == null || items.size() < min || items.size() > max) {
            throw new IllegalArgumentException(field + " count must be " + min + ".." + max);
        }
        for (T item : items) {
            if (item == null) {
                throw new IllegalArgumentException(field + " must not contain null");
            }
        }
        return List.copyOf(items);
    }

    private static <T> void requireUnique(String field, List<T> items, Function<T, String> key) {
        Set<String> seen = new HashSet<>(items.size());
        for (T item : items) {
            if (!seen.add(key.apply(item))) {
                throw new IllegalArgumentException(field + " must be unique");
            }
        }
    }
}
