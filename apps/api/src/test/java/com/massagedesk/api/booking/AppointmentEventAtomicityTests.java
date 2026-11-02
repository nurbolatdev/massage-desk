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
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Proves the event and the change commit or roll back together. Deliberately not
 * {@code @Transactional}: a test-managed transaction would hide real commit and rollback. Rows
 * belong to a dedicated client and service and are deleted in {@link #cleanUp()}.
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class AppointmentEventAtomicityTests {

    private static final String PHONE = "+998900000504";
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
    private PlatformTransactionManager transactionManager;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    private UUID clientId;
    private UUID serviceId;
    private UUID hoursId;

    @BeforeEach
    void setUp() {
        hoursId = workingHours.saveAndFlush(
                new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0))).getId();
        clientId = clients.saveAndFlush(new Client(PHONE, "Atomicity client")).getId();
        serviceId = services.saveAndFlush(
                new MassageService("Atomicity", 60, new BigDecimal("100000.00"), 1)).getId();
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("""
                delete from events where entity_id in (select id from appointments where client_id = ?)
                """, clientId);
        jdbc.update("delete from appointments where client_id = ?", clientId);
        jdbc.update("delete from clients where id = ?", clientId);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from working_hours where id = ?", hoursId);
    }

    @Test
    void conflictWritesNoEvent() {
        service.create(clientId, serviceId, TUE_10, AppointmentSource.MANUAL, EventActor.MASTER);

        assertThatThrownBy(() -> service.create(
                clientId, serviceId, TUE_10.plusSeconds(1800), AppointmentSource.MANUAL, EventActor.MASTER))
                .isInstanceOfSatisfying(BookingException.class,
                        e -> assertThat(e.reason()).isEqualTo(Reason.TIME_TAKEN));

        assertThat(jdbc.queryForObject(
                "select count(*) from appointments where client_id = ?", Integer.class, clientId)).isEqualTo(1);
        assertThat(createdEvents()).isEqualTo(1);
    }

    @Test
    void failureAfterEventRollsBackBoth() {
        AtomicReference<UUID> created = new AtomicReference<>();
        TransactionTemplate template = new TransactionTemplate(transactionManager);

        assertThatThrownBy(() -> template.executeWithoutResult(status -> {
            AppointmentView view = service.create(
                    clientId, serviceId, TUE_10, AppointmentSource.MANUAL, EventActor.MASTER);
            created.set(view.id());
            entityManager.flush();
            assertThat(eventsOf(view.id())).isEqualTo(1);
            throw new IllegalStateException("fail after the event");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(created.get()).isNotNull();
        assertThat(jdbc.queryForObject(
                "select count(*) from appointments where id = ?", Integer.class, created.get())).isZero();
        assertThat(eventsOf(created.get())).isZero();
    }

    @Test
    void cancelCommitsWithItsEvent() {
        AppointmentView view = service.create(
                clientId, serviceId, TUE_10, AppointmentSource.MANUAL, EventActor.MASTER);

        service.cancel(view.id(), EventActor.MASTER);

        assertThat(jdbc.queryForObject(
                "select status from appointments where id = ?", String.class, view.id())).isEqualTo("cancelled");
        assertThat(jdbc.queryForObject(
                "select count(*) from events where entity_id = ? and type = 'appointment_cancelled'",
                Integer.class, view.id())).isEqualTo(1);
    }

    private int createdEvents() {
        return jdbc.queryForObject("""
                select count(*) from events
                where type = 'appointment_created'
                  and entity_id in (select id from appointments where client_id = ?)
                """, Integer.class, clientId);
    }

    private int eventsOf(UUID id) {
        return jdbc.queryForObject("select count(*) from events where entity_id = ?", Integer.class, id);
    }
}
