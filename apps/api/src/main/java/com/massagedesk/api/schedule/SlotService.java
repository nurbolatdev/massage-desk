package com.massagedesk.api.schedule;

import com.massagedesk.api.booking.Appointment;
import com.massagedesk.api.booking.AppointmentRepository;
import com.massagedesk.api.booking.AppointmentStatus;
import com.massagedesk.api.schedule.SlotCalculator.Interval;
import com.massagedesk.api.schedule.SlotCalculator.WorkingBlock;
import com.massagedesk.api.settings.SettingsRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Free start times for a service on one day. Free time is computed by code from the stored schedule;
 * the window is the local day in the master's time zone.
 */
@Service
public class SlotService {

    /** Free start times of one day, with the zone and the length the starts were computed for. */
    public record DaySlots(LocalDate day, ZoneId zone, Duration duration, List<Instant> starts) {
    }

    private final MassageServiceRepository services;
    private final WorkingHoursRepository workingHours;
    private final TimeOffRepository timeOff;
    private final AppointmentRepository appointments;
    private final SettingsRepository settings;
    private final SlotProperties properties;
    private final Clock clock;
    private final SlotCalculator calculator = new SlotCalculator();

    public SlotService(
            MassageServiceRepository services,
            WorkingHoursRepository workingHours,
            TimeOffRepository timeOff,
            AppointmentRepository appointments,
            SettingsRepository settings,
            SlotProperties properties,
            Clock clock) {
        this.services = services;
        this.workingHours = workingHours;
        this.timeOff = timeOff;
        this.appointments = appointments;
        this.settings = settings;
        this.properties = properties;
        this.clock = clock;
    }

    /** Returns the free starts, or empty when the service is unknown or inactive. */
    @Transactional(readOnly = true)
    public Optional<DaySlots> freeStarts(UUID serviceId, LocalDate day) {
        return freeStarts(serviceId, day, null);
    }

    /**
     * Returns the free starts, or empty when the service is unknown or inactive. When
     * {@code excludeAppointmentId} points to a confirmed appointment, that appointment does not
     * occupy time and its booked length is used instead of the service length; an unknown or
     * non-confirmed appointment is ignored.
     */
    @Transactional(readOnly = true)
    public Optional<DaySlots> freeStarts(
            UUID serviceId, LocalDate day, @Nullable UUID excludeAppointmentId) {
        Optional<MassageService> found = services.findByIdAndActiveTrue(serviceId);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        MassageService service = found.get();
        Optional<Appointment> moving = excludeAppointmentId == null
                ? Optional.empty()
                : appointments.findById(excludeAppointmentId)
                        .filter(a -> a.getStatus() == AppointmentStatus.CONFIRMED);
        Duration duration = moving
                .map(a -> Duration.between(a.getPeriod().start(), a.getPeriod().end()))
                .orElseGet(service::getDuration);
        UUID excludedId = moving.map(Appointment::getId).orElse(null);

        ZoneId zone = settings.get().getTimeZone();
        Instant windowStart = day.atStartOfDay(zone).toInstant();
        Instant windowEnd = day.plusDays(1).atStartOfDay(zone).toInstant();

        List<WorkingBlock> blocks = workingHours.findByWeekdayOrderByStartTimeAsc(day.getDayOfWeek()).stream()
                .map(h -> new WorkingBlock(h.getStartTime(), h.getEndTime()))
                .toList();
        List<Interval> busy = new ArrayList<>();
        timeOff.findOverlapping(windowStart, windowEnd)
                .forEach(t -> busy.add(new Interval(t.getPeriod().start(), t.getPeriod().end())));
        appointments.findConfirmedOverlapping(windowStart, windowEnd).stream()
                .filter(a -> !a.getId().equals(excludedId))
                .forEach(a -> busy.add(new Interval(a.getPeriod().start(), a.getPeriod().end())));

        List<Instant> starts = calculator.freeStarts(new SlotCalculator.Request(
                day,
                zone,
                blocks,
                busy,
                duration,
                properties.step(),
                clock.instant().plus(properties.minNotice())));
        return Optional.of(new DaySlots(day, zone, duration, starts));
    }

    /**
     * Whether the range lies inside one working block of its local day, outside time off and not
     * before now plus the minimum notice. Appointments are not checked here: the database refuses
     * overlapping confirmed appointments.
     */
    @Transactional(readOnly = true)
    public boolean fitsSchedule(TimeRange period) {
        ZoneId zone = settings.get().getTimeZone();
        LocalDate day = LocalDate.ofInstant(period.start(), zone);
        List<WorkingBlock> blocks = workingHours.findByWeekdayOrderByStartTimeAsc(day.getDayOfWeek()).stream()
                .map(h -> new WorkingBlock(h.getStartTime(), h.getEndTime()))
                .toList();
        List<Interval> busy = timeOff.findOverlapping(period.start(), period.end()).stream()
                .map(t -> new Interval(t.getPeriod().start(), t.getPeriod().end()))
                .toList();
        return calculator.fits(
                new SlotCalculator.Request(
                        day,
                        zone,
                        blocks,
                        busy,
                        Duration.between(period.start(), period.end()),
                        properties.step(),
                        clock.instant().plus(properties.minNotice())),
                period.start());
    }
}
