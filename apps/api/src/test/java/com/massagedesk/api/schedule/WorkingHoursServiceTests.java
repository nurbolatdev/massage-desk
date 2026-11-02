package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.WorkingHoursService.Block;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class WorkingHoursServiceTests {

    @Autowired
    private WorkingHoursService service;

    @Autowired
    private SlotService slotService;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ClientRepository clients;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from working_hours");
    }

    private static Block block(DayOfWeek day, String start, String end) {
        return new Block(day, LocalTime.parse(start), LocalTime.parse(end));
    }

    private long count() {
        Long n = jdbc.queryForObject("select count(*) from working_hours", Long.class);
        return n == null ? 0 : n;
    }

    @Test
    void storesExactlyTheGivenBlocksOrdered() {
        List<WorkingHours> stored = service.replaceWeek(List.of(
                block(DayOfWeek.TUESDAY, "14:00", "18:00"),
                block(DayOfWeek.MONDAY, "09:00", "13:00"),
                block(DayOfWeek.TUESDAY, "09:00", "12:00")), false);

        assertThat(stored).extracting(WorkingHours::getWeekday, WorkingHours::getStartTime,
                        WorkingHours::getEndTime)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(13, 0)),
                        org.assertj.core.groups.Tuple.tuple(DayOfWeek.TUESDAY, LocalTime.of(9, 0), LocalTime.of(12, 0)),
                        org.assertj.core.groups.Tuple.tuple(DayOfWeek.TUESDAY, LocalTime.of(14, 0), LocalTime.of(18, 0)));
        assertThat(service.week()).hasSize(3);
    }

    @Test
    void secondReplaceRemovesTheFirstSetCompletely() {
        service.replaceWeek(List.of(block(DayOfWeek.MONDAY, "09:00", "13:00"),
                block(DayOfWeek.FRIDAY, "09:00", "13:00")), false);

        service.replaceWeek(List.of(block(DayOfWeek.MONDAY, "09:00", "13:00")), false);

        assertThat(count()).isEqualTo(1);
    }

    @Test
    void emptyListClearsTheWeek() {
        service.replaceWeek(List.of(block(DayOfWeek.MONDAY, "09:00", "13:00")), false);

        assertThat(service.replaceWeek(List.of(), false)).isEmpty();

        assertThat(count()).isZero();
    }

    @Test
    void blockThatDoesNotStartBeforeItEndsIsRefused() {
        assertThatThrownBy(() -> service.replaceWeek(List.of(block(DayOfWeek.MONDAY, "09:00", "09:00")), false))
                .isInstanceOfSatisfying(ScheduleException.class, e -> {
                    assertThat(e.reason()).isEqualTo(ScheduleException.Reason.INVALID_HOURS);
                    assertThat(e.getMessage()).isEqualTo("block must start before it ends");
                });
        assertThatThrownBy(() -> service.replaceWeek(List.of(block(DayOfWeek.MONDAY, "13:00", "09:00")), false))
                .isInstanceOf(ScheduleException.class)
                .hasMessage("block must start before it ends");
    }

    @Test
    void overlappingAndTouchingBlocksOfOneDayAreRefusedAndTheOldWeekStays() {
        service.replaceWeek(List.of(block(DayOfWeek.MONDAY, "09:00", "13:00")), false);

        assertThatThrownBy(() -> service.replaceWeek(List.of(
                block(DayOfWeek.TUESDAY, "09:00", "13:00"), block(DayOfWeek.TUESDAY, "12:00", "15:00")), false))
                .isInstanceOf(ScheduleException.class)
                .hasMessage("blocks of one day must not overlap or touch");
        assertThatThrownBy(() -> service.replaceWeek(List.of(
                block(DayOfWeek.TUESDAY, "09:00", "13:00"), block(DayOfWeek.TUESDAY, "13:00", "15:00")), false))
                .isInstanceOf(ScheduleException.class)
                .hasMessage("blocks of one day must not overlap or touch");

        assertThat(count()).isEqualTo(1);
        assertThat(service.week()).singleElement()
                .satisfies(w -> assertThat(w.getWeekday()).isEqualTo(DayOfWeek.MONDAY));
    }

    @Test
    void sameTimesOnDifferentDaysAreAccepted() {
        service.replaceWeek(List.of(block(DayOfWeek.MONDAY, "09:00", "13:00"),
                block(DayOfWeek.TUESDAY, "09:00", "13:00"), block(DayOfWeek.SUNDAY, "09:00", "13:00")), false);

        assertThat(count()).isEqualTo(3);
    }

    @Test
    void replacedBlocksReachFreeTime() {
        MassageService classic = services.saveAndFlush(
                new MassageService("Hours check", 60, new BigDecimal("100000.00"), 900));
        service.replaceWeek(List.of(block(DayOfWeek.TUESDAY, "10:00", "12:00")), false);

        var slots = slotService.freeStarts(classic.getId(), LocalDate.parse("2026-11-03")).orElseThrow();

        assertThat(slots.starts()).hasSize(3);

        service.replaceWeek(List.of(block(DayOfWeek.TUESDAY, "14:00", "15:00")), false);

        assertThat(slotService.freeStarts(classic.getId(), LocalDate.parse("2026-11-03")).orElseThrow().starts())
                .hasSize(1);
    }

    private UUID tuesdayAppointment() {
        Client client = clients.saveAndFlush(new Client("+998900000865", "Hours client"));
        MassageService massage = services.saveAndFlush(
                new MassageService("Hours conflict service", 60, new BigDecimal("1000.00"), 901));
        return jdbc.queryForObject("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange('2026-11-03 14:00+05'::timestamptz, '2026-11-03 15:00+05'::timestamptz),
                        'confirmed')
                returning id
                """, UUID.class, client.getId(), massage.getId());
    }

    @Test
    void weekThatLeavesAnAppointmentOutIsRefusedWithTheList() {
        UUID id = tuesdayAppointment();
        service.replaceWeek(List.of(block(DayOfWeek.TUESDAY, "10:00", "16:00")), false);

        assertThatThrownBy(() -> service.replaceWeek(List.of(block(DayOfWeek.TUESDAY, "10:00", "13:00")), false))
                .isInstanceOfSatisfying(ScheduleException.class, e -> {
                    assertThat(e.reason()).isEqualTo(ScheduleException.Reason.APPOINTMENT_CONFLICT);
                    assertThat(e.getMessage()).isEqualTo("confirmed appointments are outside the new working hours");
                    assertThat(e.conflicts()).extracting(ScheduleException.Conflict::appointmentId)
                            .containsExactly(id);
                });

        assertThat(service.week()).singleElement()
                .satisfies(w -> assertThat(w.getEndTime()).isEqualTo(LocalTime.of(16, 0)));
    }

    @Test
    void forceStoresTheWeekOverTheAppointment() {
        tuesdayAppointment();

        List<WorkingHours> stored = service.replaceWeek(List.of(block(DayOfWeek.TUESDAY, "10:00", "13:00")), true);

        assertThat(stored).hasSize(1);
    }

    @Test
    void weekThatStillCoversTheAppointmentIsStored() {
        tuesdayAppointment();

        assertThat(service.replaceWeek(List.of(block(DayOfWeek.TUESDAY, "14:00", "15:00")), false)).hasSize(1);
    }
}
