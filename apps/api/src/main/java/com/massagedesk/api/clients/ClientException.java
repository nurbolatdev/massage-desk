package com.massagedesk.api.clients;

import java.util.Objects;

/** A client command was refused. The reason tells the caller which rule applied. */
public class ClientException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** Why a client command was refused. */
    public enum Reason {
        CLIENT_NOT_FOUND,
        INVALID_PHONE,
        PHONE_TAKEN
    }

    private final Reason reason;

    public ClientException(Reason reason, String message) {
        super(message);
        this.reason = Objects.requireNonNull(reason, "reason");
    }

    public ClientException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = Objects.requireNonNull(reason, "reason");
    }

    public Reason reason() {
        return reason;
    }
}
