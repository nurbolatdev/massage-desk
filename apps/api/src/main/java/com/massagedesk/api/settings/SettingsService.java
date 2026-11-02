package com.massagedesk.api.settings;

import com.massagedesk.api.events.Changes;
import com.massagedesk.api.events.DomainEventRecorder;
import com.massagedesk.api.events.DomainEventType;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.schedule.ScheduleException;
import com.massagedesk.api.schedule.ScheduleLock;
import com.massagedesk.api.schedule.WorkingHoursCoverage;
import java.time.ZoneId;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads and changes the business settings. */
@Service
public class SettingsService {

    private final SettingsRepository settings;

    private final DomainEventRecorder recorder;

    private final ScheduleLock scheduleLock;

    private final WorkingHoursCoverage coverage;

    public SettingsService(
            SettingsRepository settings, DomainEventRecorder recorder, ScheduleLock scheduleLock,
            WorkingHoursCoverage coverage) {
        this.settings = settings;
        this.recorder = recorder;
        this.scheduleLock = scheduleLock;
        this.coverage = coverage;
    }

    @Transactional(readOnly = true)
    public Settings current() {
        return settings.get();
    }

    /**
     * A null argument leaves the field unchanged; a blank address clears it. A change writes one
     * {@code settings_changed} event (the address is only named, never copied). Working hours are
     * stored in local time, so a time zone change moves free time like a new week: it takes the
     * schedule lock first, before the settings row is read (the advisory lock always comes before
     * row locks). An update without a time zone does not take it and only locks the settings row.
     * Lock order: schedule lock (only with a time zone), then the settings row.
     *
     * <p>A time zone that differs from the stored one is checked against the stored week: confirmed
     * appointments that start from now on and fall outside the working hours in the new zone refuse
     * the whole update with {@code APPOINTMENT_CONFLICT}, unless {@code force} is set. The same zone
     * moves nothing and is not checked. Appointments are never changed.
     */
    @Transactional
    public Settings update(String timeZone, String address, Boolean botEnabled, boolean force,
            EventActor actor) {
        ZoneId newZone = timeZone == null ? null : region(timeZone.trim());
        if (newZone != null) {
            scheduleLock.acquire();
        }
        Settings row = settings.getForUpdate();
        ZoneId oldZone = row.getTimeZone();
        String oldAddress = row.getAddress();
        boolean oldBot = row.isBotEnabled();
        if (newZone != null) {
            if (!newZone.equals(oldZone)) {
                List<ScheduleException.Conflict> conflicts = coverage.uncoveredByStoredWeek(newZone);
                if (!force && !conflicts.isEmpty()) {
                    throw new ScheduleException(ScheduleException.Reason.APPOINTMENT_CONFLICT,
                            "confirmed appointments are outside the working hours in the new time zone", conflicts);
                }
            }
            row.changeTimeZone(newZone);
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
            throw new SettingsException(SettingsException.Reason.UNKNOWN_TIME_ZONE, "unknown time zone");
        }
        ZoneId zone = ZoneId.of(id);
        if (zone.getRules().isFixedOffset()) {
            throw new SettingsException(SettingsException.Reason.UNKNOWN_TIME_ZONE, "unknown time zone");
        }
        return zone;
    }
}
