package com.massagedesk.api.schedule;

import com.massagedesk.api.booking.Appointment;
import com.massagedesk.api.booking.AppointmentRepository;
import com.massagedesk.api.events.DomainEventRecorder;
import com.massagedesk.api.events.DomainEventType;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.settings.SettingsRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates, lists and removes the master's time off. */
@Service
public class TimeOffService {

    private static final Duration MAX_LENGTH = Duration.ofDays(366);
    private static final Duration MAX_AHEAD = Duration.ofDays(730);

    /** A stored time off with the master's zone for display. */
    public record TimeOffView(UUID id, TimeRange period, String reason, ZoneId zone) {
    }

    private final TimeOffRepository timeOff;
    private final AppointmentRepository appointments;
    private final SettingsRepository settings;
    private final Clock clock;
    private final ScheduleLock scheduleLock;
    private final DomainEventRecorder recorder;

    public TimeOffService(
            TimeOffRepository timeOff, AppointmentRepository appointments, SettingsRepository settings,
            Clock clock, ScheduleLock scheduleLock,
            DomainEventRecorder recorder) {
        this.recorder = recorder;
        this.scheduleLock = scheduleLock;
        this.timeOff = timeOff;
        this.appointments = appointments;
        this.settings = settings;
        this.clock = clock;
    }

    /**
     * Adds time off. Confirmed appointments inside the period are never changed; without {@code force}
     * they refuse the command with {@code APPOINTMENT_CONFLICT} and the list of those appointments.
     */
    @Transactional
    public TimeOffView create(Instant start, Instant end, String reason, boolean force,
            EventActor actor) {
        if (!start.isBefore(end)) {
            throw invalid("time off must start before it ends");
        }
        Instant now = clock.instant();
        if (!end.isAfter(now) || start.isAfter(now.plus(MAX_AHEAD))
                || Duration.between(start, end).compareTo(MAX_LENGTH) > 0) {
            throw invalid("time off must end in the future, start within two years and last at most 366 days");
        }
        scheduleLock.acquire();
        ZoneId zone = settings.get().getTimeZone();
        List<Appointment> overlapping = appointments.findConfirmedOverlapping(start, end);
        if (!force && !overlapping.isEmpty()) {
            throw new ScheduleException(ScheduleException.Reason.APPOINTMENT_CONFLICT,
                    "time off overlaps confirmed appointments", conflicts(overlapping, zone));
        }
        String cleaned = reason == null || reason.isBlank() ? null : reason.trim();
        TimeOff saved = timeOff.saveAndFlush(new TimeOff(new TimeRange(start, end), cleaned));
        Map<String, Object> payload = period(saved);
        payload.put("forced", force);
        payload.put("conflict_ids", overlapping.stream().map(Appointment::getId).toList());
        recorder.record(DomainEventType.TIME_OFF_CREATED, saved.getId(), actor, payload);
        return view(saved, zone);
    }

    private static List<ScheduleException.Conflict> conflicts(List<Appointment> found, ZoneId zone) {
        return found.stream().map(a -> ScheduleException.Conflict.of(a, zone)).toList();
    }

    /** The event holds the period only: the free-text reason may contain private details. */
    private static Map<String, Object> period(TimeOff t) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("start", t.getPeriod().start().toString());
        payload.put("end", t.getPeriod().end().toString());
        return payload;
    }

    @Transactional
    public void delete(UUID id, EventActor actor) {
        TimeOff found = timeOff.findById(id).orElseThrow(
                () -> new ScheduleException(ScheduleException.Reason.TIME_OFF_NOT_FOUND, "time off not found"));
        timeOff.delete(found);
        timeOff.flush();
        recorder.record(DomainEventType.TIME_OFF_DELETED, id, actor, period(found));
    }

    /** Time off overlapping the local days {@code from..to}, both inclusive, ordered by start. */
    @Transactional(readOnly = true)
    public List<TimeOffView> between(LocalDate from, LocalDate to) {
        ZoneId zone = settings.get().getTimeZone();
        Instant windowStart = from.atStartOfDay(zone).toInstant();
        Instant windowEnd = to.plusDays(1).atStartOfDay(zone).toInstant();
        return timeOff.findOverlapping(windowStart, windowEnd).stream().map(t -> view(t, zone)).toList();
    }

    private static TimeOffView view(TimeOff t, ZoneId zone) {
        return new TimeOffView(t.getId(), t.getPeriod(), t.getReason(), zone);
    }

    private static ScheduleException invalid(String message) {
        return new ScheduleException(ScheduleException.Reason.INVALID_TIME_OFF, message);
    }
}
