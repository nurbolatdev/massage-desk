package com.massagedesk.api.events;

/** Who caused the change. Values match the {@code events.actor} check. */
public enum EventActor {
    CLIENT,
    BOT,
    MASTER,
    ADMIN,
    SYSTEM
}
