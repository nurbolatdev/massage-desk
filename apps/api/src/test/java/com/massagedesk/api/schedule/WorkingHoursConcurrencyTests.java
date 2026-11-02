package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.schedule.WorkingHoursService.Block;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Parallel replacements of the week against the real database. Deliberately not
 * {@code @Transactional}: a test-managed transaction would put every call on one connection and
 * hide the race. Each call runs its own transaction; rows are deleted in {@link #cleanUp()}.
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class WorkingHoursConcurrencyTests {

    private static final int ROUNDS = 20;
    private static final String[][] TUESDAY = {
        {"10:00", "12:00"}, {"10:30", "12:30"}, {"11:00", "13:00"}, {"11:30", "13:30"}};

    @Autowired
    private WorkingHoursService service;

    @Autowired
    private JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from working_hours");
    }

    @Test
    void parallelReplacementsLeaveExactlyOneSubmittedWeek() throws Exception {
        for (int round = 0; round < ROUNDS; round++) {
            runRound();
        }
    }

    private void runRound() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(TUESDAY.length);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<?>> futures = new ArrayList<>();
            for (String[] times : TUESDAY) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return service.replaceWeek(List.of(new Block(
                            DayOfWeek.TUESDAY, LocalTime.parse(times[0]), LocalTime.parse(times[1]))));
                }));
            }
            start.countDown();
            for (Future<?> future : futures) {
                future.get(30, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
        List<String> rows = service.week().stream()
                .map(w -> w.getStartTime() + "-" + w.getEndTime())
                .toList();
        assertThat(rows).hasSize(1);
        assertThat(List.of("10:00-12:00", "10:30-12:30", "11:00-13:00", "11:30-13:30"))
                .containsAnyElementsOf(rows);
    }
}
