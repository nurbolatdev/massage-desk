package com.massagedesk.api.settings;

import com.massagedesk.api.events.Changes;
import com.massagedesk.api.events.DomainEventRecorder;
import com.massagedesk.api.events.DomainEventType;
import com.massagedesk.api.events.EventActor;
import java.time.ZoneId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads and changes the business settings. */
@Service
public class SettingsService {

    private final SettingsRepository settings;

    private final DomainEventRecorder recorder;

    public SettingsService(SettingsRepository settings, DomainEventRecorder recorder) {
        this.settings = settings;
        this.recorder = recorder;
    }

    @Transactional(readOnly = true)
    public Settings current() {
        return settings.get();
    }

    /**
     * A null argument leaves the field unchanged; a blank address clears it. A change writes one
     * {@code settings_changed} event (the address is only named, never copied).
     */
    @Transactional
    public Settings update(String timeZone, String address, Boolean botEnabled, EventActor actor) {
        Settings row = settings.get();
        ZoneId oldZone = row.getTimeZone();
        String oldAddress = row.getAddress();
        boolean oldBot = row.isBotEnabled();
        if (timeZone != null) {
            row.changeTimeZone(region(timeZone.trim()));
        }
        if (address != null) {
            row.changeAddress(address);
        }
        if (botEnabled != null) {
            row.changeBotEnabled(botEnabled);
        }
        Settings saved = settings.saveAndFlush(row);
        Changes changes = new Changes()
                .value("time_zone", oldZone.getId(), saved.getTimeZone().getId())
                .personal("address", oldAddress, saved.getAddress())
                .value("bot_enabled", oldBot, saved.isBotEnabled());
        if (!changes.isEmpty()) {
            recorder.record(DomainEventType.SETTINGS_CHANGED, actor, changes.payload());
        }
        return saved;
    }

    private static ZoneId region(String id) {
        if (!ZoneId.getAvailableZoneIds().contains(id)) {
            throw new SettingsException("unknown time zone");
        }
        ZoneId zone = ZoneId.of(id);
        if (zone.getRules().isFixedOffset()) {
            throw new SettingsException("unknown time zone");
        }
        return zone;
    }
}
