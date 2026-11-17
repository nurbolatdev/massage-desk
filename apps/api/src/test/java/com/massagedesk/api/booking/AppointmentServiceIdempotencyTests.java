package com.massagedesk.api.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.AppointmentService.AppointmentView;
import com.massagedesk.api.booking.AppointmentService.RequestKey;
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
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class AppointmentServiceIdempotencyTests {

    private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-000000000506");
    private static final UUID OTHER_USER = UUID.fromString("00000000-0000-0000-0000-000000000507");
    private static final UUID KEY = UUID.fromString("10000000-0000-0000-0000-000000000506");
    private static final Instant TUE_10 = Instant.parse("2026-11-03T05:00:00Z");
    private static final Instant TUE_11 = TUE_10.plusSeconds(3600);

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
    private MassageService relax;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from working_hours");
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)));
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(12, 0)));
        client = clients.saveAndFlush(new Client("+998900000506", "Idempotency client"));
        classic = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
        relax = services.saveAndFlush(new MassageService("Relax", 90, new BigDecimal("150000.00"), 2));
    }

    @Test
    void replaysTheFirstResult() {
        RequestKey key = new RequestKey(USER, KEY);

        AppointmentView first = service.create(
                client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER, key);
        AppointmentView replay = service.create(
                client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER, key);

        assertThat(replay).isEqualTo(first);
        assertThat(clientAppointmentCount()).isEqualTo(1);
        assertThat(createdEventCount()).isEqualTo(1);
    }

    @Test
    void sameInstantInAnotherOffsetIsTheSameRequest() {
        RequestKey key = new RequestKey(USER, KEY);
        Instant startPlusFive = OffsetDateTime.parse("2026-11-03T10:00:00+05:00").toInstant();

        AppointmentView first = service.create(
                client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER, key);
        AppointmentView replay = service.create(
                client.getId(), classic.getId(), startPlusFive, AppointmentSource.MANUAL, EventActor.MASTER, key);

        assertThat(replay).isEqualTo(first);
        assertThat(clientAppointmentCount()).isEqualTo(1);
    }

    @Test
    void anotherBodyWithTheSameKeyIsRefused() {
        RequestKey key = new RequestKey(USER, KEY);
        service.create(client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER, key);

        assertThatThrownBy(() -> service.create(
                client.getId(), classic.getId(), TUE_11, AppointmentSource.MANUAL, EventActor.MASTER, key))
                .isInstanceOfSatisfying(BookingException.class, e -> {
                    assertThat(e.reason()).isEqualTo(Reason.IDEMPOTENCY_KEY_REUSED);
                    assertThat(e.getMessage()).isEqualTo("idempotency key was already used with another request");
                });
        assertThatThrownBy(() -> service.create(
                client.getId(), relax.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER, key))
                .isInstanceOfSatisfying(BookingException.class,
                        e -> assertThat(e.reason()).isEqualTo(Reason.IDEMPOTENCY_KEY_REUSED));
        assertThat(clientAppointmentCount()).isEqualTo(1);
    }

    @Test
    void replayReturnsTheAppointmentAsCreated() {
        RequestKey key = new RequestKey(USER, KEY);
        AppointmentView created = service.create(
                client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER, key);
        service.cancel(created.id(), EventActor.MASTER);
        entityManager.flush();
        entityManager.clear();

        AppointmentView replay = service.create(
                client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER, key);

        assertThat(replay.id()).isEqualTo(created.id());
        assertThat(replay.status()).isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(replay.period()).isEqualTo(created.period());
        assertThat(clientAppointmentCount()).isEqualTo(1);
    }

    @Test
    void keysAreScopedToTheStaffMember() {
        AppointmentView first = service.create(
                client.getId(),
                classic.getId(),
                TUE_10,
                AppointmentSource.MANUAL,
                EventActor.MASTER,
                new RequestKey(USER, KEY));
        AppointmentView second = service.create(
                client.getId(),
                classic.getId(),
                TUE_11,
                AppointmentSource.MANUAL,
                EventActor.MASTER,
                new RequestKey(OTHER_USER, KEY));

        assertThat(second.id()).isNotEqualTo(first.id());
        assertThat(clientAppointmentCount()).isEqualTo(2);
    }

    @Test
    void expiredKeyIsForgotten() {
        RequestKey key = new RequestKey(USER, KEY);
        AppointmentView first = service.create(
                client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER, key);

        Instant exactly24hAgo = FixedClockConfiguration.NOW.minus(Duration.ofHours(24));
        jdbc.update(
                "update idempotency_keys set created_at = ? where user_id = ? and idempotency_key = ?",
                Timestamp.from(exactly24hAgo),
                USER,
                KEY);
        entityManager.clear();

        AppointmentView stillValid = service.create(
                client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER, key);
        assertThat(stillValid.id()).isEqualTo(first.id());

        Instant expired = exactly24hAgo.minusSeconds(1);
        jdbc.update(
                "update idempotency_keys set created_at = ? where user_id = ? and idempotency_key = ?",
                Timestamp.from(expired),
                USER,
                KEY);
        entityManager.clear();

        AppointmentView second = service.create(
                client.getId(), classic.getId(), TUE_11, AppointmentSource.MANUAL, EventActor.MASTER, key);

        assertThat(second.id()).isNotEqualTo(first.id());
        List<UUID> storedAppointments = jdbc.queryForList(
                "select appointment_id from idempotency_keys where user_id = ? and idempotency_key = ?",
                UUID.class,
                USER,
                KEY);
        assertThat(storedAppointments).containsExactly(second.id());
    }

    @Test
    void failedCreateStoresNoKey() {
        RequestKey key = new RequestKey(USER, KEY);
        Instant outsideHours = Instant.parse("2026-11-03T10:30:00Z");

        assertThatThrownBy(() -> service.create(
                client.getId(), classic.getId(), outsideHours, AppointmentSource.MANUAL, EventActor.MASTER, key))
                .isInstanceOfSatisfying(BookingException.class,
                        e -> assertThat(e.reason()).isEqualTo(Reason.OUTSIDE_SCHEDULE));
        assertThat(keyCount(USER, KEY)).isZero();

        AppointmentView created = service.create(
                client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER, key);
        assertThat(created.id()).isNotNull();
        assertThat(keyCount(USER, KEY)).isEqualTo(1);
    }

    @Test
    void withoutKeyNothingIsStored() {
        AppointmentView created = service.create(
                client.getId(), classic.getId(), TUE_10, AppointmentSource.MANUAL, EventActor.MASTER);

        assertThat(jdbc.queryForObject(
                "select count(*) from idempotency_keys where appointment_id = ?",
                Integer.class,
                created.id())).isZero();
    }

    private int clientAppointmentCount() {
        return jdbc.queryForObject(
                "select count(*) from appointments where client_id = ?", Integer.class, client.getId());
    }

    private int createdEventCount() {
        return jdbc.queryForObject("""
                select count(*) from events
                where type = 'appointment_created'
                  and entity_id in (select id from appointments where client_id = ?)
                """, Integer.class, client.getId());
    }

    private int keyCount(UUID userId, UUID key) {
        return jdbc.queryForObject(
                "select count(*) from idempotency_keys where user_id = ? and idempotency_key = ?",
                Integer.class,
                userId,
                key);
    }
}
