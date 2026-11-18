package com.massagedesk.api.settings;

import java.util.Objects;

/** A settings change was refused; the message is safe to show to the caller. */
public class SettingsException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** Why a settings change was refused. */
    public enum Reason {
        UNKNOWN_TIME_ZONE
    }

    private final Reason reason;

    public SettingsException(Reason reason, String message) {
        super(message);
        this.reason = Objects.requireNonNull(reason, "reason");
    }

    public Reason reason() {
        return reason;
    }
}
