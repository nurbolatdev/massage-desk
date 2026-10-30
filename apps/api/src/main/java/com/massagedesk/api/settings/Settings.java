package com.massagedesk.api.settings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.ZoneId;

/** The single settings row created by the migration. */
@Entity
@Table(name = "settings")
public class Settings {

    @Id
    @Column(name = "id")
    private Boolean id;

    @Column(name = "time_zone", nullable = false)
    private String timeZone;

    @Column(name = "address")
    private String address;

    @Column(name = "bot_enabled", nullable = false)
    private boolean botEnabled;

    protected Settings() {
    }

    public Boolean getId() {
        return id;
    }

    public ZoneId getTimeZone() {
        return ZoneId.of(timeZone);
    }

    public String getAddress() {
        return address;
    }

    public boolean isBotEnabled() {
        return botEnabled;
    }
}
