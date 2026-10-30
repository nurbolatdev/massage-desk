package com.massagedesk.api.persistence;

import jakarta.persistence.AttributeConverter;
import java.util.Locale;

/** Stores an enum as its lowercase constant name, matching text columns with check lists. */
public abstract class LowercaseEnumConverter<E extends Enum<E>> implements AttributeConverter<E, String> {

    private final Class<E> type;

    protected LowercaseEnumConverter(Class<E> type) {
        this.type = type;
    }

    @Override
    public String convertToDatabaseColumn(E attribute) {
        return attribute == null ? null : attribute.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public E convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        for (E constant : type.getEnumConstants()) {
            if (constant.name().toLowerCase(Locale.ROOT).equals(dbData)) {
                return constant;
            }
        }
        throw new IllegalArgumentException("Unknown " + type.getSimpleName() + " value: " + dbData);
    }
}
