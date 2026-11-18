package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.Appointment;
import com.massagedesk.api.booking.AppointmentRepository;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class SlotServiceTests {

    @Autowired
    private SlotService slotService;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    @Autowired
    private TimeOffRepository timeOff;

    @Autowired
    private AppointmentRepository appointments;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private JdbcTemplate jdbc;

    private MassageService classic;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from working_hours");
        classic = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
    }

    private void block(DayOfWeek day, int fromHour, int toHour) {
        workingHours.saveAndFlush(new WorkingHours(day, LocalTime.of(fromHour, 0), LocalTime.of(toHour, 0)));
    }

    private static TimeRange range(String start, String end) {
        return new TimeRange(Instant.parse(start), Instant.parse(end));
    }

    @Test
    void combinesBreaksTimeOffAndConfirmedAppointments() {
        block(DayOfWeek.TUESDAY, 10, 12);
        block(DayOfWeek.TUESDAY, 13, 16);
        Client client = clients.saveAndFlush(new Client("+998900000301", "Test client"));
        appointments.saveAndFlush(new Appointment(client, classic,
                range("2026-11-03T08:00:00Z", "2026-11-03T09:00:00Z"), AppointmentSource.MANUAL));
        timeOff.saveAndFlush(new TimeOff(range("2026-11-03T10:00:00Z", "2026-11-03T10:30:00Z"), "errand"));

        var result = slotService.freeStarts(classic.getId(), LocalDate.parse("2026-11-03")).orElseThrow();

        // 11:30 does not fit before 12:00; 12:00-13:00 is the break; 13:00 and 13:30 overlap the appointment;
        // 14:30 and 15:00 overlap the time off; 15:30 does not fit before 16:00
        assertThat(result.starts()).containsExactly(
                Instant.parse("2026-11-03T05:00:00Z"),
                Instant.parse("2026-11-03T05:30:00Z"),
                Instant.parse("2026-11-03T06:00:00Z"),
                Instant.parse("2026-11-03T09:00:00Z"));
    }

    @Test
    void hidesStartsBeforeNow() {
        block(DayOfWeek.MONDAY, 10, 12);

        var result = slotService.freeStarts(classic.getId(), LocalDate.parse("2026-11-02")).orElseThrow();

        assertThat(result.starts()).containsExactly(
                Instant.parse("2026-11-02T05:30:00Z"),
                Instant.parse("2026-11-02T06:00:00Z"));
    }

    @Test
    void fitsScheduleChecksHoursTimeOffAndNow() {
        block(DayOfWeek.TUESDAY, 10, 16);
        block(DayOfWeek.MONDAY, 9, 12);
        timeOff.saveAndFlush(new TimeOff(range("2026-11-03T09:00:00Z", "2026-11-03T10:00:00Z"), "errand")); // 14:00-15:00

        assertThat(slotService.fitsSchedule(range("2026-11-03T05:00:00Z", "2026-11-03T06:00:00Z"))).isTrue();
        assertThat(slotService.fitsSchedule(range("2026-11-03T08:30:00Z", "2026-11-03T09:30:00Z"))).isFalse();
        assertThat(slotService.fitsSchedule(range("2026-11-03T10:30:00Z", "2026-11-03T11:30:00Z"))).isFalse();
        assertThat(slotService.fitsSchedule(range("2026-11-03T04:30:00Z", "2026-11-03T05:30:00Z"))).isFalse();
        assertThat(slotService.fitsSchedule(range("2026-11-02T05:00:00Z", "2026-11-02T06:00:00Z"))).isFalse(); // 10:00, before now
        assertThat(slotService.fitsSchedule(range("2026-11-02T05:15:00Z", "2026-11-02T06:15:00Z"))).isTrue();
    }

    @Test
    void ignoresAppointments() {
        block(DayOfWeek.TUESDAY, 10, 16);
        Client client = clients.saveAndFlush(new Client("+998900000302", "Test client"));
        TimeRange period = range("2026-11-03T05:00:00Z", "2026-11-03T06:00:00Z");
        appointments.saveAndFlush(new Appointment(client, classic, period, AppointmentSource.MANUAL));

        assertThat(slotService.fitsSchedule(period)).isTrue();
    }

    @Test
    void emptyForUnknownOrInactiveService() {
        MassageService inactive = services.saveAndFlush(new MassageService("Old", 45, new BigDecimal("1.00"), 0));
        jdbc.update("update services set active = false where id = ?", inactive.getId());

        assertThat(slotService.freeStarts(UUID.randomUUID(), LocalDate.parse("2026-11-03"))).isEmpty();
        assertThat(slotService.freeStarts(inactive.getId(), LocalDate.parse("2026-11-03"))).isEmpty();
    }
}
