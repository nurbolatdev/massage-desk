package com.massagedesk.api.events;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Builds the payload of an "something was edited" event:
 * {@code {"changed": [field, ...], "from": {...}, "to": {...}}}.
 *
 * <p>Fields are compared one by one and only real differences are kept (decimals by value, so
 * {@code 100} equals {@code 100.00}). {@link #value} also copies the old and the new value into
 * {@code from}/{@code to}; {@link #personal} only names the field in {@code changed}, because
 * events are append-only and must not hold personal data such as names, notes or addresses.
 */
public final class Changes {

    private final List<String> changed = new ArrayList<>();
    private final Map<String, Object> from = new LinkedHashMap<>();
    private final Map<String, Object> to = new LinkedHashMap<>();

    /** Records a change of a field that is not personal data; no-op when the values are equal. */
    public Changes value(String field, Object oldValue, Object newValue) {
        if (differs(oldValue, newValue)) {
            changed.add(field);
            from.put(field, plain(oldValue));
            to.put(field, plain(newValue));
        }
        return this;
    }

    /** Records that a personal field changed, without copying either value. */
    public Changes personal(String field, Object oldValue, Object newValue) {
        if (differs(oldValue, newValue)) {
            changed.add(field);
        }
        return this;
    }

    public boolean isEmpty() {
        return changed.isEmpty();
    }

    public Map<String, Object> payload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("changed", List.copyOf(changed));
        payload.put("from", new LinkedHashMap<>(from));
        payload.put("to", new LinkedHashMap<>(to));
        return payload;
    }

    private static boolean differs(Object a, Object b) {
        if (a instanceof BigDecimal x && b instanceof BigDecimal y) {
            return x.compareTo(y) != 0;
        }
        return !Objects.equals(a, b);
    }

    private static Object plain(Object value) {
        return value instanceof BigDecimal decimal ? decimal.toPlainString() : value;
    }
}
