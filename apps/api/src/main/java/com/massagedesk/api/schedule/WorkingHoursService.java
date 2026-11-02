package com.massagedesk.api.schedule;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Comparator;
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

    private final WorkingHoursRepository workingHours;
    private final ScheduleLock scheduleLock;

    public WorkingHoursService(WorkingHoursRepository workingHours, ScheduleLock scheduleLock) {
        this.workingHours = workingHours;
        this.scheduleLock = scheduleLock;
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
     */
    @Transactional
    public List<WorkingHours> replaceWeek(List<Block> blocks) {
        validate(blocks);
        scheduleLock.acquire();
        workingHours.deleteAllInBatch();
        workingHours.saveAll(blocks.stream()
                .map(b -> new WorkingHours(b.weekday(), b.start(), b.end()))
                .toList());
        workingHours.flush();
        return workingHours.findAllByOrderByWeekdayAscStartTimeAsc();
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
