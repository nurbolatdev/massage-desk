package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.events.EventActor;
import jakarta.persistence.EntityManager;
import java.time.Instant;
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
 * Proves a time off and its event commit or roll back together. Deliberately not
 * {@code @Transactional}: a test-managed transaction would hide real commit and rollback. The
 * tables of the time off are emptied before and after every test.
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class ScheduleEventAtomicityTests {

    private static final Instant START = Instant.parse("2026-11-02T19:00:00Z");
    private static final Instant END = Instant.parse("2026-11-03T19:00:00Z");

    @Autowired
    private TimeOffService service;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    @AfterEach
    void cleanUp() {
        jdbc.update("delete from events where type in ('time_off_created', 'time_off_deleted')");
        jdbc.update("delete from time_off");
    }

    @Test
    void failureAfterEventRollsBackBoth() {
        AtomicReference<UUID> created = new AtomicReference<>();
        TransactionTemplate template = new TransactionTemplate(transactionManager);

        assertThatThrownBy(() -> template.executeWithoutResult(status -> {
            created.set(service.create(START, END, null, false, EventActor.MASTER).id());
            entityManager.flush();
            assertThat(eventsOf(created.get())).isEqualTo(1);
            throw new IllegalStateException("fail after the event");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(created.get()).isNotNull();
        assertThat(jdbc.queryForObject("select count(*) from time_off", Integer.class)).isZero();
        assertThat(eventsOf(created.get())).isZero();
    }

    @Test
    void deleteCommitsWithItsEvent() {
        UUID id = service.create(START, END, null, false, EventActor.MASTER).id();

        service.delete(id, EventActor.MASTER);

        assertThat(jdbc.queryForObject("select count(*) from time_off", Integer.class)).isZero();
        assertThat(jdbc.queryForObject(
                "select count(*) from events where entity_id = ? and type = 'time_off_deleted'",
                Integer.class, id)).isEqualTo(1);
    }

    private int eventsOf(UUID id) {
        return jdbc.queryForObject("select count(*) from events where entity_id = ?", Integer.class, id);
    }
}
