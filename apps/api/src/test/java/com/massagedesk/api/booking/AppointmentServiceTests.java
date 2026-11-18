package com.massagedesk.api.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.AppointmentService.AppointmentView;
import com.massagedesk.api.booking.BookingException.Reason;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.EventActor;
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
import java.util.List;
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
                () -> service.create(clientId, serviceId, start, AppointmentSource.MANUAL, EventActor.MASTER));
    }

    @Test
    void createsConfirmedManualAppointment() {
        AppointmentView view = service.create(
                client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER);

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
                client.getId(), classic.getId(), TUE_10.plusSeconds(900), AppointmentSource.MANUAL, EventActor.MASTER);

        assertThat(view.period().start()).isEqualTo(TUE_10.plusSeconds(900));
    }

    @Test
    void backToBackIsAllowed() {
        insertConfirmed("2026-11-03 10:00+05", "2026-11-03 11:00+05");

        AppointmentView view = service.create(
                client.getId(), classic.getId(), TUE_10.plusSeconds(3600), AppointmentSource.MANUAL, EventActor.MASTER);

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
                client.getId(), classic.getId(), TUE_10.plusSeconds(1800), AppointmentSource.MANUAL, EventActor.MASTER))
                .isInstanceOfSatisfying(BookingException.class, e -> {
                    assertThat(e.reason()).isEqualTo(Reason.TIME_TAKEN);
                    assertThat(e.getMessage()).isEqualTo("time is already booked");
                    assertThat(sqlState(e)).isEqualTo("23P01");
                });
    }

    private static final Instant TUE_13 = Instant.parse("2026-11-03T08:00:00Z");

    private AppointmentView book(Instant start) {
        return service.create(client.getId(), classic.getId(), start, AppointmentSource.MANUAL, EventActor.MASTER);
    }

    private Map<String, Object> periodOf(UUID id) {
        entityManager.flush();
        return jdbc.queryForMap(
                "select lower(period) as s, upper(period) as e, status from appointments where id = ?", id);
    }

    @Test
    void rescheduleMovesAndKeepsLength() {
        AppointmentView created = book(TUE_10);

        AppointmentView moved = service.reschedule(created.id(), TUE_13, EventActor.MASTER);

        assertThat(moved.period().start()).isEqualTo(TUE_13);
        assertThat(moved.period().end()).isEqualTo(TUE_13.plusSeconds(3600));
        Map<String, Object> row = periodOf(created.id());
        assertThat(((java.sql.Timestamp) row.get("s")).toInstant()).isEqualTo(TUE_13);
        assertThat(((java.sql.Timestamp) row.get("e")).toInstant()).isEqualTo(TUE_13.plusSeconds(3600));
    }

    @Test
    void rescheduleKeepsBookedLengthAfterServiceChange() {
        AppointmentView created = book(TUE_10);
        jdbc.update("update services set duration_min = 90 where id = ?", classic.getId());
        entityManager.clear();

        AppointmentView moved = service.reschedule(created.id(), TUE_13, EventActor.MASTER);

        assertThat(moved.period().end()).isEqualTo(TUE_13.plusSeconds(3600));
    }

    @Test
    void rescheduleOverOwnOldTime() {
        AppointmentView created = book(TUE_10);

        AppointmentView moved = service.reschedule(created.id(), TUE_10.plusSeconds(1800), EventActor.MASTER);

        assertThat(moved.period().start()).isEqualTo(TUE_10.plusSeconds(1800));
    }

    @Test
    void rescheduleOutsideSchedule() {
        AppointmentView created = book(TUE_10);

        assertThatThrownBy(() -> service.reschedule(created.id(), Instant.parse("2026-11-03T10:30:00Z"), EventActor.MASTER))
                .isInstanceOfSatisfying(BookingException.class,
                        e -> assertThat(e.reason()).isEqualTo(Reason.OUTSIDE_SCHEDULE));
        Map<String, Object> row = periodOf(created.id());
        assertThat(((java.sql.Timestamp) row.get("s")).toInstant()).isEqualTo(TUE_10);
    }

    @Test
    void rescheduleIntoTakenTime() {
        AppointmentView created = book(TUE_10);
        insertConfirmed("2026-11-03 13:00+05", "2026-11-03 14:00+05");

        // last statement of the test: the database transaction is aborted after the conflict
        assertThatThrownBy(() -> service.reschedule(created.id(), TUE_13, EventActor.MASTER))
                .isInstanceOfSatisfying(BookingException.class, e -> {
                    assertThat(e.reason()).isEqualTo(Reason.TIME_TAKEN);
                    assertThat(sqlState(e)).isEqualTo("23P01");
                });
    }

    @Test
    void cancelFreesTheTime() {
        AppointmentView created = book(TUE_10);

        AppointmentView cancelled = service.cancel(created.id(), EventActor.MASTER);

        assertThat(cancelled.status()).isEqualTo(AppointmentStatus.CANCELLED);
        assertThat(book(TUE_10).id()).isNotEqualTo(created.id());
    }

    @Test
    void actionsOnCancelledAreRefused() {
        AppointmentView created = book(TUE_10);
        service.cancel(created.id(), EventActor.MASTER);
        Instant outside = Instant.parse("2026-11-03T04:00:00Z");

        for (Runnable action : new Runnable[] {
                () -> service.cancel(created.id(), EventActor.MASTER),
                () -> service.markNoShow(created.id(), EventActor.MASTER),
                () -> service.reschedule(created.id(), outside, EventActor.MASTER)}) {
            assertThatThrownBy(action::run).isInstanceOfSatisfying(BookingException.class, e -> {
                assertThat(e.reason()).isEqualTo(Reason.NOT_CONFIRMED);
                assertThat(e.getMessage()).isEqualTo("appointment is cancelled");
            });
        }
    }

    @Test
    void noShowAfterStart() {
        insertConfirmed("2026-11-02 09:00+05", "2026-11-02 10:00+05");
        insertConfirmed("2026-11-02 10:00+05", "2026-11-02 11:00+05");
        entityManager.clear();
        List<UUID> ids = jdbc.queryForList(
                "select id from appointments where client_id = ?", UUID.class, client.getId());

        assertThat(ids).hasSize(2);
        for (UUID id : ids) {
            assertThat(service.markNoShow(id, EventActor.MASTER).status()).isEqualTo(AppointmentStatus.NO_SHOW);
        }
    }

    @Test
    void noShowBeforeStart() {
        AppointmentView created = book(TUE_10);

        assertThatThrownBy(() -> service.markNoShow(created.id(), EventActor.MASTER))
                .isInstanceOfSatisfying(BookingException.class, e -> {
                    assertThat(e.reason()).isEqualTo(Reason.NOT_STARTED);
                    assertThat(e.getMessage()).isEqualTo("appointment has not started yet");
                });
    }

    @Test
    void unknownAppointment() {
        UUID id = UUID.randomUUID();

        for (Runnable action : new Runnable[] {
                () -> service.reschedule(id, TUE_10, EventActor.MASTER),
                () -> service.cancel(id, EventActor.MASTER),
                () -> service.markNoShow(id, EventActor.MASTER)}) {
            assertThatThrownBy(action::run).isInstanceOfSatisfying(BookingException.class,
                    e -> assertThat(e.reason()).isEqualTo(Reason.APPOINTMENT_NOT_FOUND));
        }
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
