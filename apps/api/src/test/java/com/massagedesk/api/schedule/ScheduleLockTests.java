package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.schedule.WorkingHoursService.Block;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Proves that every write that changes free time waits for the one schedule lock. A holder thread
 * keeps the lock inside a transaction; the operation under test runs on another thread and must
 * show up in {@code pg_locks} as a waiting advisory lock on the same key, and may finish only
 * after the holder releases it. Deliberately not {@code @Transactional}: each side needs its own
 * connection and transaction.
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class ScheduleLockTests {

    private static final String PHONE = "+998900000861";
    private static final Instant BOOKED = Instant.parse("2026-11-03T09:00:00Z");

    @Autowired
    private AppointmentService appointments;

    @Autowired
    private TimeOffService timeOff;

    @Autowired
    private WorkingHoursService workingHours;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository hours;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private UUID clientId;
    private UUID serviceId;
    private UUID bookedId;

    @BeforeEach
    void setUp() {
        hours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)));
        clientId = clients.saveAndFlush(new Client(PHONE, "Lock client")).getId();
        serviceId = services.saveAndFlush(new MassageService("Lock", 60, new BigDecimal("100000.00"), 1)).getId();
        bookedId = appointments.create(clientId, serviceId, BOOKED, AppointmentSource.MANUAL, EventActor.MASTER).id();
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from events where entity_id in (select id from appointments where client_id = ?)", clientId);
        jdbc.update("delete from appointments where client_id = ?", clientId);
        jdbc.update("delete from clients where id = ?", clientId);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from events where type in ('time_off_created', 'time_off_deleted', 'working_hours_replaced')");
        jdbc.update("delete from time_off");
        jdbc.update("delete from working_hours");
    }

    static Stream<String> operations() {
        return Stream.of("create", "reschedule", "timeOff", "workingHours");
    }

    @ParameterizedTest
    @MethodSource("operations")
    void writeWaitsForTheScheduleLock(String operation) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch held = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        try {
            Future<?> holder = pool.submit(() -> new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
                jdbc.queryForObject("select cast(pg_advisory_xact_lock(?) as text)", String.class, ScheduleLock.KEY);
                held.countDown();
                try {
                    release.await(10, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertThat(held.await(10, TimeUnit.SECONDS)).isTrue();

            Future<?> write = pool.submit(() -> run(operation));
            awaitWaitingLock();
            assertThat(write.isDone()).as("%s must wait for the lock", operation).isFalse();

            release.countDown();
            holder.get(10, TimeUnit.SECONDS);
            write.get(10, TimeUnit.SECONDS);
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }

    private void run(String operation) {
        switch (operation) {
            case "create" -> appointments.create(
                    clientId, serviceId, Instant.parse("2026-11-03T05:00:00Z"), AppointmentSource.MANUAL, EventActor.MASTER);
            case "reschedule" -> appointments.reschedule(bookedId, Instant.parse("2026-11-03T10:00:00Z"), EventActor.MASTER);
            case "timeOff" -> timeOff.create(
                    Instant.parse("2026-11-03T19:00:00Z"), Instant.parse("2026-11-04T19:00:00Z"), null, false, EventActor.MASTER);
            case "workingHours" -> workingHours.replaceWeek(List.of(
                    new Block(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)),
                    new Block(DayOfWeek.WEDNESDAY, LocalTime.of(10, 0), LocalTime.of(12, 0))), false, EventActor.MASTER);
            default -> throw new IllegalArgumentException(operation);
        }
    }

    private void awaitWaitingLock() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (System.nanoTime() < deadline) {
            Integer waiting = jdbc.queryForObject("""
                    select count(*) from pg_locks
                    where locktype = 'advisory' and not granted
                      and classid = 0 and objid = 7301001 and objsubid = 1
                    """, Integer.class);
            if (waiting != null && waiting > 0) {
                return;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("no waiting advisory lock on the schedule key");
    }
}
