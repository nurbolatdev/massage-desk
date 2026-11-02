package com.massagedesk.api.settings;

/** A settings change was refused; the message is safe to show to the caller. */
public class SettingsException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public SettingsException(String message) {
        super(message);
    }
}
