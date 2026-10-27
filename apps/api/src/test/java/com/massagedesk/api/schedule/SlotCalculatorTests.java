package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.schedule.SlotCalculator.Interval;
import com.massagedesk.api.schedule.SlotCalculator.Request;
import com.massagedesk.api.schedule.SlotCalculator.WorkingBlock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;

class SlotCalculatorTests {

    private static final ZoneId TASHKENT = ZoneId.of("Asia/Tashkent"); // UTC+5, no DST
    private static final LocalDate DAY = LocalDate.of(2026, 11, 2);
    private static final List<WorkingBlock> TEN_TO_TWELVE =
            List.of(new WorkingBlock(LocalTime.of(10, 0), LocalTime.of(12, 0)));

    private final SlotCalculator calculator = new SlotCalculator();

    private static Instant utc(String iso) {
        return Instant.parse(iso);
    }

    private static Request request(List<WorkingBlock> blocks, List<Interval> busy, Instant notBefore) {
        return new Request(DAY, TASHKENT, blocks, busy, Duration.ofMinutes(60), Duration.ofMinutes(30), notBefore);
    }

    @Test
    void offersEveryStepThatFitsInsideWorkingHours() {
        assertThat(calculator.freeStarts(request(TEN_TO_TWELVE, List.of(), null)))
                .containsExactly(
                        utc("2026-11-02T05:00:00Z"), // 10:00 local
                        utc("2026-11-02T05:30:00Z"),
                        utc("2026-11-02T06:00:00Z")); // 11:00 local, ends exactly at 12:00
    }

    @Test
    void skipsTimesThatOverlapAnAppointment() {
        var busy = List.of(new Interval(utc("2026-11-02T05:30:00Z"), utc("2026-11-02T06:30:00Z")));

        assertThat(calculator.freeStarts(request(TEN_TO_TWELVE, busy, null))).isEmpty();
    }

    @Test
    void allowsAStartExactlyWhenAnotherAppointmentEnds() {
        var busy = List.of(new Interval(utc("2026-11-02T05:00:00Z"), utc("2026-11-02T06:00:00Z")));

        assertThat(calculator.freeStarts(request(TEN_TO_TWELVE, busy, null)))
                .containsExactly(utc("2026-11-02T06:00:00Z"));
    }

    @Test
    void respectsABreakBetweenWorkingBlocks() {
        var blocks = List.of(
                new WorkingBlock(LocalTime.of(10, 0), LocalTime.of(11, 0)),
                new WorkingBlock(LocalTime.of(12, 0), LocalTime.of(13, 0)));

        assertThat(calculator.freeStarts(request(blocks, List.of(), null)))
                .containsExactly(utc("2026-11-02T05:00:00Z"), utc("2026-11-02T07:00:00Z"));
    }

    @Test
    void doesNotOfferTimesBeforeTheNoticeLimit() {
        var notBefore = utc("2026-11-02T05:15:00Z"); // now + minimum notice, computed by the caller

        assertThat(calculator.freeStarts(request(TEN_TO_TWELVE, List.of(), notBefore)))
                .containsExactly(utc("2026-11-02T05:30:00Z"), utc("2026-11-02T06:00:00Z"));
    }

    @Test
    void returnsNothingOnADayOff() {
        assertThat(calculator.freeStarts(request(List.of(), List.of(), null))).isEmpty();
    }

    @Test
    void timeOffCoveringTheWholeDayBlocksEverything() {
        var dayOff = List.of(new Interval(utc("2026-11-01T19:00:00Z"), utc("2026-11-02T19:00:00Z")));

        assertThat(calculator.freeStarts(request(TEN_TO_TWELVE, dayOff, null))).isEmpty();
    }

    @Test
    void rejectsInvalidInput() {
        assertThatThrownBy(() -> new WorkingBlock(LocalTime.of(12, 0), LocalTime.of(10, 0)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Request(DAY, TASHKENT, TEN_TO_TWELVE, List.of(), Duration.ZERO, Duration.ofMinutes(30), null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
