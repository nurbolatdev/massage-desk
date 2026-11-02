package com.massagedesk.api.settings;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.schedule.FixedClockConfiguration;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Settings writers queue on the settings row, so an update that does not touch the time zone
 * cannot write an old zone back over a parallel zone change. Deliberately not
 * {@code @Transactional}: each side needs its own connection and transaction.
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class SettingsConcurrencyTests {

    @Autowired
    private SettingsService settingsService;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @AfterEach
    void cleanUp() {
        jdbc.update("update settings set time_zone = 'Asia/Tashkent', address = null, bot_enabled = true");
        jdbc.update("delete from events where type = 'settings_changed'");
    }

    @Test
    void anAddressChangeDoesNotWriteAnOldTimeZoneBack() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch held = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        try {
            Future<?> holder = pool.submit(() -> new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
                jdbc.update("update settings set time_zone = 'America/New_York'");
                held.countDown();
                try {
                    release.await(10, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertThat(held.await(10, TimeUnit.SECONDS)).isTrue();

            Future<?> update = pool.submit(() -> settingsService.update(null, "Navoi 12", null, false, EventActor.MASTER));
            awaitWaitingLock();
            assertThat(update.isDone()).as("the update must wait for the settings row").isFalse();

            release.countDown();
            holder.get(10, TimeUnit.SECONDS);
            update.get(10, TimeUnit.SECONDS);
        } finally {
            release.countDown();
            pool.shutdownNow();
        }

        assertThat(jdbc.queryForObject("select time_zone from settings", String.class)).isEqualTo("America/New_York");
        assertThat(jdbc.queryForObject("select address from settings", String.class)).isEqualTo("Navoi 12");
    }

    private void awaitWaitingLock() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (System.nanoTime() < deadline) {
            Integer waiting = jdbc.queryForObject("select count(*) from pg_locks where not granted", Integer.class);
            if (waiting != null && waiting > 0) {
                return;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("no waiting lock");
    }
}
