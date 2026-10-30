package com.massagedesk.api.schedule;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;

/**
 * Maps {@link TimeRange} to the text form of a PostgreSQL {@code tstzrange}.
 *
 * <p>The attribute must also declare {@code columnDefinition = "tstzrange"} (so schema validation
 * matches the column type) and {@code @ColumnTransformer(write = "cast(? as tstzrange)")} (so the
 * text parameter is accepted on insert and update).
 *
 * <p>Only {@code [start, end)} with both bounds present is supported; anything else is rejected.
 */
@Converter
public class TimeRangeConverter implements AttributeConverter<TimeRange, String> {

    private static final DateTimeFormatter DB_FORMAT = new DateTimeFormatterBuilder()
            .append(DateTimeFormatter.ISO_LOCAL_DATE)
            .appendLiteral(' ')
            .append(DateTimeFormatter.ISO_LOCAL_TIME)
            .appendOffset("+HH:mm:ss", "+00")
            .toFormatter();

    @Override
    public String convertToDatabaseColumn(TimeRange range) {
        if (range == null) {
            return null;
        }
        return "[\"" + range.start() + "\",\"" + range.end() + "\")";
    }

    @Override
    public TimeRange convertToEntityAttribute(String value) {
        if (value == null) {
            return null;
        }
        if (value.length() < 2 || value.charAt(0) != '[' || value.charAt(value.length() - 1) != ')') {
            throw unsupported(value);
        }
        String[] bounds = value.substring(1, value.length() - 1).split(",", -1);
        if (bounds.length != 2) {
            throw unsupported(value);
        }
        return new TimeRange(parseBound(bounds[0], value), parseBound(bounds[1], value));
    }

    private static Instant parseBound(String bound, String raw) {
        String text = bound.trim();
        if (text.length() >= 2 && text.startsWith("\"") && text.endsWith("\"")) {
            text = text.substring(1, text.length() - 1);
        }
        if (text.isEmpty() || text.contains("infinity")) {
            throw unsupported(raw);
        }
        try {
            return DB_FORMAT.parse(text, Instant::from);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Unsupported time range: " + raw, e);
        }
    }

    private static IllegalArgumentException unsupported(String raw) {
        return new IllegalArgumentException("Unsupported time range: " + raw);
    }
}
