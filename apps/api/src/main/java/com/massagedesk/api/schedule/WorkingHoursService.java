package com.massagedesk.api.schedule;

import com.massagedesk.api.booking.Appointment;
import com.massagedesk.api.booking.AppointmentRepository;
import com.massagedesk.api.events.DomainEventRecorder;
import com.massagedesk.api.events.DomainEventType;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.settings.SettingsRepository;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads and replaces the weekly working hours. */
@Service
public class WorkingHoursService {

    /** One working block of a weekday, in the master's local time. */
    public record Block(DayOfWeek weekday, LocalTime start, LocalTime end) {
    }

    /**
     * How far ahead appointments are checked against a new week: the app's planning horizon. It
     * bounds the work of one save; appointments further ahead are not reported.
     */
    static final Duration CONFLICT_HORIZON = Duration.ofDays(60);

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final WorkingHoursRepository workingHours;
    private final ScheduleLock scheduleLock;
    private final AppointmentRepository appointments;
    private final SettingsRepository settings;
    private final SlotProperties slotProperties;
    private final Clock clock;
    private final DomainEventRecorder recorder;

    public WorkingHoursService(
            WorkingHoursRepository workingHours, ScheduleLock scheduleLock, AppointmentRepository appointments,
            SettingsRepository settings, SlotProperties slotProperties, Clock clock,
            DomainEventRecorder recorder) {
        this.workingHours = workingHours;
        this.scheduleLock = scheduleLock;
        this.appointments = appointments;
        this.settings = settings;
        this.slotProperties = slotProperties;
        this.clock = clock;
        this.recorder = recorder;
    }

    /** The whole week ordered by weekday, then start. */
    @Transactional(readOnly = true)
    public List<WorkingHours> week() {
        return workingHours.findAllByOrderByWeekdayAscStartTimeAsc();
    }

    /**
     * Replaces the whole week in one transaction. The rules are checked over the complete set
     * before anything is written. The schedule lock orders parallel replacements and also orders the
     * week against bookings and time off: in READ COMMITTED two replacements would otherwise both
     * delete the old rows and both insert, leaving the union of two weeks or a constraint failure. The old rows go with a bulk delete that runs at once;
     * {@code deleteAll()} would let Hibernate flush the inserts first, and the new rows would hit
     * the exclusion constraint against the old ones.
     *
     * <p>Confirmed appointments that start from now within {@link #CONFLICT_HORIZON} and do not fit
     * inside one block of the new week refuse the command with {@code APPOINTMENT_CONFLICT} and the
     * list of those appointments, unless {@code force} is set. Appointments are never changed.
     * Appointments that already started are not reported.
     *
     * <p>A replacement that changes the week writes one {@code working_hours_replaced} event with the
     * old and the new week; an identical week writes none.
     */
    @Transactional
    public List<WorkingHours> replaceWeek(List<Block> blocks, boolean force, EventActor actor) {
        validate(blocks);
        scheduleLock.acquire();
        List<ScheduleException.Conflict> conflicts = uncovered(blocks, settings.get().getTimeZone());
        if (!force && !conflicts.isEmpty()) {
            throw new ScheduleException(ScheduleException.Reason.APPOINTMENT_CONFLICT,
                    "confirmed appointments are outside the new working hours", conflicts);
        }
        List<Block> before = workingHours.findAllByOrderByWeekdayAscStartTimeAsc().stream()
                .map(w -> new Block(w.getWeekday(), w.getStartTime(), w.getEndTime()))
                .toList();
        workingHours.deleteAllInBatch();
        workingHours.saveAll(blocks.stream()
                .map(b -> new WorkingHours(b.weekday(), b.start(), b.end()))
                .toList());
        workingHours.flush();
        List<WorkingHours> stored = workingHours.findAllByOrderByWeekdayAscStartTimeAsc();
        List<Block> after = stored.stream()
                .map(w -> new Block(w.getWeekday(), w.getStartTime(), w.getEndTime()))
                .toList();
        if (!before.equals(after)) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("from", week(before));
            payload.put("to", week(after));
            payload.put("forced", force);
            payload.put("conflict_ids", conflicts.stream().map(ScheduleException.Conflict::appointmentId).toList());
            recorder.record(DomainEventType.WORKING_HOURS_REPLACED, actor, payload);
        }
        return stored;
    }

    private static List<Map<String, Object>> week(List<Block> blocks) {
        return blocks.stream().map(b -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("weekday", b.weekday().getValue());
            entry.put("start", b.start().format(HH_MM));
            entry.put("end", b.end().format(HH_MM));
            return entry;
        }).toList();
    }

    private List<ScheduleException.Conflict> uncovered(List<Block> blocks, ZoneId zone) {
        Instant now = clock.instant();
        Map<DayOfWeek, List<SlotCalculator.WorkingBlock>> week = blocks.stream().collect(Collectors.groupingBy(
                Block::weekday,
                Collectors.mapping(b -> new SlotCalculator.WorkingBlock(b.start(), b.end()), Collectors.toList())));
        SlotCalculator calculator = new SlotCalculator();
        return appointments.findConfirmedOverlapping(now, now.plus(CONFLICT_HORIZON)).stream()
                .filter(a -> !a.getPeriod().start().isBefore(now))
                .filter(a -> !fits(calculator, week, a, zone))
                .map(a -> new ScheduleException.Conflict(
                        a.getId(),
                        a.getClient().getName(),
                        a.getPeriod().start().atZone(zone).toOffsetDateTime(),
                        a.getPeriod().end().atZone(zone).toOffsetDateTime()))
                .toList();
    }

    private boolean fits(
            SlotCalculator calculator, Map<DayOfWeek, List<SlotCalculator.WorkingBlock>> week, Appointment a,
            ZoneId zone) {
        Instant start = a.getPeriod().start();
        LocalDate day = LocalDate.ofInstant(start, zone);
        List<SlotCalculator.WorkingBlock> dayBlocks = week.getOrDefault(day.getDayOfWeek(), List.of());
        return calculator.fits(new SlotCalculator.Request(
                day, zone, dayBlocks, List.of(), a.getService().getDuration(), slotProperties.step(), null), start);
    }

    private static void validate(List<Block> blocks) {
        for (Block block : blocks) {
            if (!block.start().isBefore(block.end())) {
                throw invalid("block must start before it ends");
            }
        }
        Map<DayOfWeek, List<Block>> byDay = blocks.stream().collect(Collectors.groupingBy(Block::weekday));
        for (List<Block> day : byDay.values()) {
            List<Block> sorted = day.stream().sorted(Comparator.comparing(Block::start)).toList();
            for (int i = 1; i < sorted.size(); i++) {
                if (!sorted.get(i).start().isAfter(sorted.get(i - 1).end())) {
                    throw invalid("blocks of one day must not overlap or touch");
                }
            }
        }
    }

    private static ScheduleException invalid(String message) {
        return new ScheduleException(ScheduleException.Reason.INVALID_HOURS, message);
    }
}
