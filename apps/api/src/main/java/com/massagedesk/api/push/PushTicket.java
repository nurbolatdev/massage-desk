package com.massagedesk.api.push;

import org.jspecify.annotations.Nullable;

/**
 * Per-message ticket from the Expo Push API {@code data} array.
 */
record PushTicket(boolean ok, @Nullable String error) {

    private static final String DEVICE_NOT_REGISTERED = "DeviceNotRegistered";

    boolean deviceNotRegistered() {
        return DEVICE_NOT_REGISTERED.equals(error);
    }
}
