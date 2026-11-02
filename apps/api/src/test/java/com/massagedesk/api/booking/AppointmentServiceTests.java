package com.massagedesk.api.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.AppointmentService.AppointmentView;
import com.massagedesk.api.booking.BookingException.Reason;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.WorkingHours;
import com.massagedesk.api.schedule.WorkingHoursRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
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
class AppointmentServiceTests {

    private static final Instant TUE_10 = Instant.parse("2026-11-03T05:00:00Z");

    @Autowired
    private AppointmentService service;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    private Client client;
    private MassageService classic;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from working_hours");
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)));
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(12, 0)));
        client = clients.saveAndFlush(new Client("+998900000501", "Test client"));
        classic = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
    }

    private void insertConfirmed(String from, String to) {
        jdbc.update("""
                insert into appointments (client_id, service_id, period, status)
                values (?, ?, tstzrange(?::timestamptz, ?::timestamptz), 'confirmed')
                """, client.getId(), classic.getId(), from, to);
    }

    private BookingException refused(UUID clientId, UUID serviceId, Instant start) {
        return org.assertj.core.api.Assertions.catchThrowableOfType(
                BookingException.class,
                () -> service.create(clientId, serviceId, start, AppointmentSource.MANUAL));
    }

    @Test
    void createsConfirmedManualAppointment() {
        AppointmentView view = service.create(client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL);

        assertThat(view.id()).isNotNull();
        assertThat(view.period().start()).isEqualTo(TUE_10);
        assertThat(view.period().end()).isEqualTo(TUE_10.plusSeconds(3600));
        assertThat(view.status()).isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(view.source()).isEqualTo(AppointmentSource.MANUAL);
        assertThat(view.zone()).isEqualTo(ZoneId.of("Asia/Tashkent"));
        entityManager.flush();
        Map<String, Object> row = jdbc.queryForMap(
                "select status, source from appointments where id = ?", view.id());
        assertThat(row).containsEntry("status", "confirmed").containsEntry("source", "manual");
    }

    @Test
    void offGridStartIsAllowed() {
        AppointmentView view = service.create(
                client.getId(), classic.getId(), TUE_10.plusSeconds(900), AppointmentSource.MANUAL);

        assertThat(view.period().start()).isEqualTo(TUE_10.plusSeconds(900));
    }

    @Test
    void backToBackIsAllowed() {
        insertConfirmed("2026-11-03 10:00+05", "2026-11-03 11:00+05");

        AppointmentView view = service.create(
                client.getId(), classic.getId(), TUE_10.plusSeconds(3600), AppointmentSource.MANUAL);

        assertThat(view.id()).isNotNull();
    }

    @Test
    void unknownClient() {
        assertThat(refused(UUID.randomUUID(), classic.getId(), TUE_10).reason())
                .isEqualTo(Reason.CLIENT_NOT_FOUND);
    }

    @Test
    void unknownService() {
        assertThat(refused(client.getId(), UUID.randomUUID(), TUE_10).reason())
                .isEqualTo(Reason.SERVICE_NOT_FOUND);
    }

    @Test
    void inactiveService() {
        jdbc.update("update services set active = false where id = ?", classic.getId());
        entityManager.clear();

        assertThat(refused(client.getId(), classic.getId(), TUE_10).reason())
                .isEqualTo(Reason.SERVICE_NOT_FOUND);
    }

    @Test
    void outsideScheduleIsRefused() {
        // 15:30 +05 ends after the 16:00 block end
        assertThat(refused(client.getId(), classic.getId(), Instant.parse("2026-11-03T10:30:00Z")).reason())
                .isEqualTo(Reason.OUTSIDE_SCHEDULE);
        // Monday 09:00 +05 is before the fixed now (10:15)
        assertThat(refused(client.getId(), classic.getId(), Instant.parse("2026-11-02T04:00:00Z")).reason())
                .isEqualTo(Reason.OUTSIDE_SCHEDULE);
    }

    @Test
    void overlapIsTimeTaken() {
        insertConfirmed("2026-11-03 10:00+05", "2026-11-03 11:00+05");

        // last statement of the test: the database transaction is aborted after the conflict
        assertThatThrownBy(() -> service.create(
                client.getId(), classic.getId(), TUE_10.plusSeconds(1800), AppointmentSource.MANUAL))
                .isInstanceOfSatisfying(BookingException.class, e -> {
                    assertThat(e.reason()).isEqualTo(Reason.TIME_TAKEN);
                    assertThat(e.getMessage()).isEqualTo("time is already booked");
                    assertThat(sqlState(e)).isEqualTo("23P01");
                });
    }

    private static String sqlState(Throwable e) {
        Throwable current = e;
        while (current != null) {
            if (current instanceof SQLException sql) {
                return sql.getSQLState();
            }
            current = current.getCause();
        }
        return null;
    }
}
