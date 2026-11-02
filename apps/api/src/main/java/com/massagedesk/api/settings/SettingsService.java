package com.massagedesk.api.settings;

import java.time.DateTimeException;
import java.time.ZoneId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads and changes the business settings. */
@Service
public class SettingsService {

    private final SettingsRepository settings;

    public SettingsService(SettingsRepository settings) {
        this.settings = settings;
    }

    @Transactional(readOnly = true)
    public Settings current() {
        return settings.get();
    }

    /** A null argument leaves the field unchanged; a blank address clears it. */
    @Transactional
    public Settings update(String timeZone, String address, Boolean botEnabled) {
        Settings row = settings.get();
        if (timeZone != null) {
            row.changeTimeZone(region(timeZone.trim()));
        }
        if (address != null) {
            row.changeAddress(address);
        }
        if (botEnabled != null) {
            row.changeBotEnabled(botEnabled);
        }
        return settings.saveAndFlush(row);
    }

    private static ZoneId region(String id) {
        if (!ZoneId.getAvailableZoneIds().contains(id)) {
            throw new SettingsException("unknown time zone");
        }
        try {
            return ZoneId.of(id);
        } catch (DateTimeException e) {
            throw new SettingsException("unknown time zone");
        }
    }
}
