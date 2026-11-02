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
 * Parallel requests against the real database. Deliberately not {@code @Transactional}: a
 * test-managed transaction would serialise everything on one connection and hide the race. Here
 * every request runs its own transaction, so the exclusion constraint and the row lock decide the
 * outcome. Rows belong to a dedicated client and service and are deleted in {@link #cleanUp()}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class ConcurrentBookingTests {

    private static final String PHONE = "+998900000505";
    private static final String TAKEN = "time is already booked";

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

    private record Outcome(int status, String detail) {
    }

    @BeforeEach
    void setUp() {
        hoursId = workingHours.saveAndFlush(
                new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0))).getId();
        clientId = clients.saveAndFlush(new Client(PHONE, "Concurrent client")).getId();
        serviceId = services.saveAndFlush(
                new MassageService("Concurrent", 60, new BigDecimal("100000.00"), 1)).getId();
    }

    @AfterEach
    void cleanUp() {
        deleteAppointments();
        jdbc.update("delete from clients where id = ?", clientId);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from working_hours where id = ?", hoursId);
    }

    @RepeatedTest(3)
    void onlyOneOfParallelBookingsSucceeds() throws Exception {
        List<Callable<Outcome>> tasks = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            tasks.add(() -> create("2026-11-03T10:00:00+05:00"));
        }

        List<Outcome> outcomes = runParallel(tasks);

        assertThat(outcomes).filteredOn(o -> o.status() == 201).hasSize(1);
        assertThat(outcomes).filteredOn(o -> o.status() == 409)
                .hasSize(5)
                .allSatisfy(o -> assertThat(o.detail()).isEqualTo(TAKEN));
        assertThat(count("select count(*) from appointments where client_id = ? and status = 'confirmed'"))
                .isEqualTo(1);
        assertThat(count("""
                select count(*) from events
                where type = 'appointment_created'
                  and entity_id in (select id from appointments where client_id = ?)
                """)).isEqualTo(1);
    }

    @Test
    void overlappingParallelBookingsConflict() throws Exception {
        for (int round = 0; round < 20; round++) {
            int base = 10 + round % 3;
            List<Callable<Outcome>> tasks = new ArrayList<>();
            for (int i = 0; i < 4; i++) {
                String start = "2026-11-03T%02d:%02d:00+05:00".formatted(base, i * 15);
                tasks.add(() -> create(start));
            }

            List<Outcome> outcomes = runParallel(tasks);

            assertThat(outcomes).as("round %d", round).noneMatch(o -> o.status() >= 500);
            assertThat(outcomes).as("round %d", round).filteredOn(o -> o.status() == 201).hasSize(1);
            assertThat(outcomes).as("round %d", round).filteredOn(o -> o.status() == 409)
                    .hasSize(3)
                    .allSatisfy(o -> assertThat(o.detail()).isEqualTo(TAKEN));
            assertThat(count("select count(*) from appointments where client_id = ? and status = 'confirmed'"))
                    .as("round %d", round).isEqualTo(1);
            deleteAppointments();
        }
    }

    @Test
    void parallelCancelsChangeOnce() throws Exception {
        Outcome created = create("2026-11-03T10:00:00+05:00");
        assertThat(created.status()).isEqualTo(201);
        UUID id = jdbc.queryForObject(
                "select id from appointments where client_id = ?", UUID.class, clientId);

        List<Callable<Outcome>> tasks = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            tasks.add(() -> send("/appointments/" + id + "/cancel", null));
        }

        List<Outcome> outcomes = runParallel(tasks);

        assertThat(outcomes).filteredOn(o -> o.status() == 200).hasSize(1);
        assertThat(outcomes).filteredOn(o -> o.status() == 409)
                .hasSize(3)
                .allSatisfy(o -> assertThat(o.detail()).isEqualTo("appointment is cancelled"));
        assertThat(jdbc.queryForObject(
                "select count(*) from events where entity_id = ? and type = 'appointment_cancelled'",
                Integer.class, id)).isEqualTo(1);
    }

    private void deleteAppointments() {
        jdbc.update("""
                delete from events where entity_id in (select id from appointments where client_id = ?)
                """, clientId);
        jdbc.update("delete from appointments where client_id = ?", clientId);
    }

    private Outcome create(String start) throws Exception {
        String json = """
                {"clientId":"%s","serviceId":"%s","start":"%s"}
                """.formatted(clientId, serviceId, start);
        return send("/appointments", json);
    }

    private Outcome send(String path, String json) throws Exception {
        var request = post(path)
                .contentType(MediaType.APPLICATION_JSON)
                .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority())));
        if (json != null) {
            request = request.content(json);
        }
        var response = mvc.perform(request).andReturn().getResponse();
        String body = response.getContentAsString();
        String detail = response.getStatus() >= 400 ? JsonPath.read(body, "$.detail") : null;
        return new Outcome(response.getStatus(), detail);
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
