package com.massagedesk.api.schedule;

import com.massagedesk.api.booking.Appointment;
import com.massagedesk.api.booking.AppointmentRepository;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Finds confirmed appointments that a week of working hours does not cover. The result is only
 * valid under the schedule lock, so every method needs the caller's transaction.
 */
@Component
public class WorkingHoursCoverage {

    private final AppointmentRepository appointments;
    private final WorkingHoursRepository workingHours;
    private final SlotProperties slotProperties;
    private final Clock clock;

    public WorkingHoursCoverage(
            AppointmentRepository appointments, WorkingHoursRepository workingHours, SlotProperties slotProperties,
            Clock clock) {
        this.appointments = appointments;
        this.workingHours = workingHours;
        this.slotProperties = slotProperties;
        this.clock = clock;
    }

    /**
     * Confirmed appointments that start at or after now, however far ahead, and do not fit inside
     * one block of {@code week} in {@code zone}, ordered by start. Call after
     * {@code ScheduleLock.acquire()}.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<ScheduleException.Conflict> uncovered(List<WorkingHoursService.Block> week, ZoneId zone) {
        return uncovered(week.stream().collect(Collectors.groupingBy(
                WorkingHoursService.Block::weekday,
                Collectors.mapping(b -> new SlotCalculator.WorkingBlock(b.start(), b.end()), Collectors.toList()))),
                zone);
    }

    /**
     * The same check over the stored week, as it would read in {@code zone}. Call after
     * {@code ScheduleLock.acquire()}.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<ScheduleException.Conflict> uncoveredByStoredWeek(ZoneId zone) {
        return uncovered(workingHours.findAllByOrderByWeekdayAscStartTimeAsc().stream().collect(Collectors.groupingBy(
                WorkingHours::getWeekday,
                Collectors.mapping(w -> new SlotCalculator.WorkingBlock(w.getStartTime(), w.getEndTime()),
                        Collectors.toList()))),
                zone);
    }

    private List<ScheduleException.Conflict> uncovered(
            Map<DayOfWeek, List<SlotCalculator.WorkingBlock>> byDay, ZoneId zone) {
        SlotCalculator calculator = new SlotCalculator();
        return appointments.findConfirmedStartingFrom(clock.instant()).stream()
                .filter(a -> !fits(calculator, byDay, a, zone))
                .map(a -> ScheduleException.Conflict.of(a, zone))
                .toList();
    }

    private boolean fits(
            SlotCalculator calculator, Map<DayOfWeek, List<SlotCalculator.WorkingBlock>> week, Appointment a,
            ZoneId zone) {
        Instant start = a.getPeriod().start();
        // the booked period counts, not the service's current duration (the service may have changed)
        Duration booked = Duration.between(start, a.getPeriod().end());
        LocalDate day = LocalDate.ofInstant(start, zone);
        List<SlotCalculator.WorkingBlock> dayBlocks = week.getOrDefault(day.getDayOfWeek(), List.of());
        return calculator.fits(new SlotCalculator.Request(
                day, zone, dayBlocks, List.of(), booked, slotProperties.step(), null), start);
    }
}
