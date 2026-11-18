package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.events.EventActor;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class ServiceEventsTests {

    @Autowired
    private ServiceCatalog catalog;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Transactional
    @Test
    void createWritesSnapshot() {
        MassageService created = catalog.create("Snap", 60, new BigDecimal("150000.50"), 4, EventActor.MASTER);

        List<Map<String, Object>> events = events(created.getId(), "service_created");
        assertThat(events).hasSize(1);
        assertThat(events.get(0)).containsEntry("actor", "master");
        assertThat(matches(events.get(0),
                "{\"name\":\"Snap\",\"duration_min\":60,\"price\":\"150000.50\",\"sort_order\":4}")).isTrue();
    }

    @Transactional
    @Test
    void priceChangeWritesUpdate() {
        MassageService created = catalog.create("Price", 60, new BigDecimal("100.00"), 1, EventActor.MASTER);

        catalog.update(created.getId(), null, null, new BigDecimal("120.50"), null, null, EventActor.ADMIN);

        List<Map<String, Object>> events = events(created.getId(), "service_updated");
        assertThat(events).hasSize(1);
        assertThat(events.get(0)).containsEntry("actor", "admin");
        assertThat(matches(events.get(0), """
                {"changed":["price"],"from":{"price":"100.00"},"to":{"price":"120.50"}}""")).isTrue();
    }

    @Transactional
    @Test
    void deactivationWithPriceChangeWritesOneDeactivatedEvent() {
        MassageService created = catalog.create("Off", 60, new BigDecimal("100.00"), 1, EventActor.MASTER);

        catalog.update(created.getId(), null, null, new BigDecimal("90.00"), null, false, EventActor.MASTER);

        assertThat(events(created.getId(), "service_updated")).isEmpty();
        List<Map<String, Object>> events = events(created.getId(), "service_deactivated");
        assertThat(events).hasSize(1);
        assertThat(matches(events.get(0), """
                {"changed":["price","active"],"from":{"price":"100.00","active":true},
                 "to":{"price":"90.00","active":false}}""")).isTrue();
    }

    @Transactional
    @Test
    void reactivationWritesUpdate() {
        MassageService created = catalog.create("Back", 60, new BigDecimal("100"), 1, EventActor.MASTER);
        catalog.update(created.getId(), null, null, null, null, false, EventActor.MASTER);

        catalog.update(created.getId(), null, null, null, null, true, EventActor.MASTER);

        List<Map<String, Object>> events = events(created.getId(), "service_updated");
        assertThat(events).hasSize(1);
        assertThat(matches(events.get(0), """
                {"changed":["active"],"from":{"active":false},"to":{"active":true}}""")).isTrue();
    }

    @Transactional
    @Test
    void noOpPatchWritesNoEvent() {
        MassageService created = catalog.create("Same", 60, new BigDecimal("100"), 1, EventActor.MASTER);

        catalog.update(created.getId(), "Same", 60, new BigDecimal("100.00"), 1, true, EventActor.MASTER);
        catalog.update(created.getId(), null, null, null, null, null, EventActor.MASTER);

        assertThat(events(created.getId(), "service_updated")).isEmpty();
        assertThat(events(created.getId(), "service_deactivated")).isEmpty();
    }

    @Transactional
    @Test
    void unknownIdWritesNoEvent() {
        UUID id = UUID.randomUUID();

        assertThatThrownBy(() -> catalog.update(id, "x", null, null, null, null, EventActor.MASTER))
                .isInstanceOf(ScheduleException.class);

        assertThat(events(id, "service_updated")).isEmpty();
    }

    @Test
    void failureAfterEventRollsBackBoth() {
        AtomicReference<UUID> created = new AtomicReference<>();
        TransactionTemplate template = new TransactionTemplate(transactionManager);

        assertThatThrownBy(() -> template.executeWithoutResult(status -> {
            MassageService service = catalog.create(
                    "Atomic", 60, new BigDecimal("100"), 1, EventActor.MASTER);
            created.set(service.getId());
            entityManager.flush();
            assertThat(jdbc.queryForObject(
                    "select count(*) from events where entity_id = ?", Integer.class, service.getId())).isEqualTo(1);
            throw new IllegalStateException("fail after the event");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(created.get()).isNotNull();
        assertThat(jdbc.queryForObject(
                "select count(*) from services where id = ?", Integer.class, created.get())).isZero();
        assertThat(jdbc.queryForObject(
                "select count(*) from events where entity_id = ?", Integer.class, created.get())).isZero();
    }

    private List<Map<String, Object>> events(UUID id, String type) {
        entityManager.flush();
        return jdbc.queryForList(
                "select actor, payload::text as payload from events where entity_id = ? and type = ?", id, type);
    }

    private boolean matches(Map<String, Object> event, String expectedJson) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select ?::jsonb = ?::jsonb", Boolean.class,
                event.get("payload"), expectedJson));
    }
}
