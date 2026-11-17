package com.massagedesk.api.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.WorkingHours;
import com.massagedesk.api.schedule.WorkingHoursRepository;
import com.massagedesk.api.security.StaffRole;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

/**
 * End-to-end idempotency tests against the real database. Deliberately not {@code @Transactional}:
 * every HTTP request must run in its own committed transaction, just like a real client retry after
 * a dropped response or concurrent retries racing on the schedule lock. Rows belong to a dedicated
 * client, service, hours and staff user and are deleted in {@link #cleanUp()}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class IdempotentBookingTests {

    private static final String PHONE = "+998900000507";
    private static final UUID STAFF_ID = UUID.fromString("00000000-0000-0000-0000-000000000201");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    @Autowired
    private JdbcTemplate jdbc;

    private UUID clientId;
    private UUID serviceId;
    private UUID hoursId;

    private record Outcome(int status, String body) {
    }

    @BeforeEach
    void setUp() {
        hoursId = workingHours.saveAndFlush(
                new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0))).getId();
        clientId = clients.saveAndFlush(new Client(PHONE, "Idempotent client")).getId();
        serviceId = services.saveAndFlush(
                new MassageService("Idempotent", 60, new BigDecimal("100000.00"), 1)).getId();
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("""
                delete from events where entity_id in (select id from appointments where client_id = ?)
                """, clientId);
        jdbc.update("delete from appointments where client_id = ?", clientId);
        jdbc.update("delete from idempotency_keys where user_id = ?", STAFF_ID);
        jdbc.update("delete from clients where id = ?", clientId);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from working_hours where id = ?", hoursId);
    }

    @Test
    void lostResponseThenRetryReturnsTheFirstAppointment() throws Exception {
        UUID key = UUID.randomUUID();
        String start = "2026-11-03T10:00:00+05:00";

        // Simulate a response lost in transit: only kept to compare against the retry.
        Outcome first = create(start, key);
        assertThat(first.status()).isEqualTo(201);

        Outcome retry = create(start, key);
        assertThat(retry.status()).isEqualTo(201);
        assertThat(retry.body()).isEqualTo(first.body());

        assertThat(count("select count(*) from appointments where client_id = ? and status = 'confirmed'"))
                .isEqualTo(1);
        assertThat(count("""
                select count(*) from events
                where type = 'appointment_created'
                  and entity_id in (select id from appointments where client_id = ?)
                """)).isEqualTo(1);

        // Without an idempotency key, the same retry fails with 409 TIME_TAKEN.
        Outcome withoutKey = create(start, null);
        assertThat(withoutKey.status()).isEqualTo(409);
        assertThat(JsonPath.<String>read(withoutKey.body(), "$.code")).isEqualTo("TIME_TAKEN");
    }

    @Test
    void startWithFractionsOfAMicrosecondIsReplayedAfterCommit() throws Exception {
        UUID key = UUID.randomUUID();
        String start = "2026-11-03T10:00:00.0000005+05:00";

        Outcome first = create(start, key);
        assertThat(first.status()).isEqualTo(201);

        Outcome retry = create(start, key);
        assertThat(retry.status()).isEqualTo(201);
        assertThat(JsonPath.<String>read(retry.body(), "$.id"))
                .isEqualTo(JsonPath.<String>read(first.body(), "$.id"));
        assertThat(count("select count(*) from appointments where client_id = ? and status = 'confirmed'"))
                .isEqualTo(1);
    }

    @RepeatedTest(3)
    void parallelRetriesWithOneKeyBookOnce() throws Exception {
        UUID key = UUID.randomUUID();
        List<Callable<Outcome>> tasks = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            tasks.add(() -> create("2026-11-03T10:00:00+05:00", key));
        }

        List<Outcome> outcomes = runParallel(tasks);

        assertThat(outcomes).noneMatch(o -> o.status() == 409 || o.status() >= 500);
        assertThat(outcomes).hasSize(6).allSatisfy(o -> assertThat(o.status()).isEqualTo(201));
        String expectedId = JsonPath.read(outcomes.get(0).body(), "$.id");
        assertThat(outcomes).allSatisfy(
                o -> assertThat(JsonPath.<String>read(o.body(), "$.id")).isEqualTo(expectedId));

        assertThat(count("select count(*) from appointments where client_id = ? and status = 'confirmed'"))
                .isEqualTo(1);
        assertThat(count("""
                select count(*) from events
                where type = 'appointment_created'
                  and entity_id in (select id from appointments where client_id = ?)
                """)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "select count(*) from idempotency_keys where user_id = ?", Integer.class, STAFF_ID))
                .isEqualTo(1);
    }

    @Test
    void parallelRequestsWithDifferentKeysStillConflict() throws Exception {
        List<Callable<Outcome>> tasks = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            tasks.add(() -> create("2026-11-03T10:00:00+05:00", UUID.randomUUID()));
        }

        List<Outcome> outcomes = runParallel(tasks);

        assertThat(outcomes).filteredOn(o -> o.status() == 201).hasSize(1);
        assertThat(outcomes).filteredOn(o -> o.status() == 409)
                .hasSize(3)
                .allSatisfy(o -> assertThat(JsonPath.<String>read(o.body(), "$.code")).isEqualTo("TIME_TAKEN"));
    }

    private Outcome create(String start, UUID key) throws Exception {
        String json = """
                {"clientId":"%s","serviceId":"%s","start":"%s"}
                """.formatted(clientId, serviceId, start);
        var request = post("/appointments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json)
                .with(jwt().jwt(j -> j.subject(STAFF_ID.toString()))
                        .authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority())));
        if (key != null) {
            request = request.header("Idempotency-Key", key.toString());
        }
        var response = mvc.perform(request).andReturn().getResponse();
        return new Outcome(response.getStatus(), response.getContentAsString());
    }

    private List<Outcome> runParallel(List<Callable<Outcome>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<Outcome>> futures = new ArrayList<>();
            for (Callable<Outcome> task : tasks) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return task.call();
                }));
            }
            start.countDown();
            List<Outcome> outcomes = new ArrayList<>();
            for (Future<Outcome> future : futures) {
                outcomes.add(future.get(30, TimeUnit.SECONDS));
            }
            return outcomes;
        } finally {
            pool.shutdownNow();
        }
    }

    private int count(String sql) {
        return jdbc.queryForObject(sql, Integer.class, clientId);
    }
}
