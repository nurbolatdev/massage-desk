package com.massagedesk.api.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import jakarta.persistence.EntityManager;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Proves that an event commits or rolls back together with the change it describes.
 *
 * <p>Deliberately not {@code @Transactional}: a test-managed transaction would hide real commit and
 * rollback behaviour. Isolation instead: every event carries a unique marker in its payload, the
 * clients use dedicated phone numbers, and {@link #cleanUp()} deletes exactly those rows.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class DomainEventTransactionTests {

    private static final String PHONE_COMMITTED = "+998900000401";
    private static final String PHONE_ROLLED_BACK = "+998900000402";
    private static final String PHONE_DUPLICATE = "+998900000403";

    @Autowired
    PlatformTransactionManager transactionManager;

    @Autowired
    ClientRepository clients;

    @Autowired
    DomainEventRecorder recorder;

    @Autowired
    EntityManager entityManager;

    @Autowired
    JdbcTemplate jdbc;

    private TransactionTemplate template;
    private String marker;

    @BeforeEach
    void setUp() {
        template = new TransactionTemplate(transactionManager);
        marker = UUID.randomUUID().toString();
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from events where payload->>'marker' = ?", marker);
        jdbc.update("delete from clients where phone in (?, ?, ?)",
                PHONE_COMMITTED, PHONE_ROLLED_BACK, PHONE_DUPLICATE);
    }

    @Test
    void committedChangeKeepsItsEvent() {
        UUID id = template.execute(status -> {
            Client client = clients.save(new Client(PHONE_COMMITTED, "Committed"));
            recorder.record(DomainEventType.CLIENT_CREATED, client.getId(), EventActor.MASTER,
                    Map.of("marker", marker));
            return client.getId();
        });

        assertThat(clientsWithPhone(PHONE_COMMITTED)).isEqualTo(1);
        assertThat(eventsWithMarker()).isEqualTo(1);
        UUID eventEntityId = jdbc.queryForObject(
                "select entity_id from events where payload->>'marker' = ?", UUID.class, marker);
        assertThat(eventEntityId).isEqualTo(id);
    }

    @Test
    void failedChangeLeavesNoEvent() {
        assertThatThrownBy(() -> template.executeWithoutResult(status -> {
            Client client = clients.save(new Client(PHONE_ROLLED_BACK, "Rolled back"));
            recorder.record(DomainEventType.CLIENT_CREATED, client.getId(), EventActor.MASTER,
                    Map.of("marker", marker));
            throw new IllegalStateException("change failed");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(clientsWithPhone(PHONE_ROLLED_BACK)).isZero();
        assertThat(eventsWithMarker()).isZero();
    }

    @Test
    void eventFlushedBeforeAFailingStatementIsRolledBack() {
        UUID existingId = jdbc.queryForObject(
                "insert into clients (phone, name) values (?, ?) returning id",
                UUID.class, PHONE_DUPLICATE, "Existing");

        assertThatThrownBy(() -> template.executeWithoutResult(status -> {
            recorder.record(DomainEventType.CLIENT_CREATED, existingId, EventActor.MASTER,
                    Map.of("marker", marker));
            entityManager.flush();
            assertThat(eventsWithMarker()).isEqualTo(1);

            clients.saveAndFlush(new Client(PHONE_DUPLICATE, "Duplicate"));
        })).isInstanceOf(DataIntegrityViolationException.class);

        assertThat(eventsWithMarker()).isZero();
    }

    @Test
    void recordingOutsideATransactionFails() {
        assertThatThrownBy(() -> recorder.record(DomainEventType.CLIENT_CREATED, UUID.randomUUID(),
                EventActor.MASTER, Map.of("marker", marker)))
                .isInstanceOf(IllegalTransactionStateException.class);

        assertThat(eventsWithMarker()).isZero();
    }

    private int eventsWithMarker() {
        return jdbc.queryForObject(
                "select count(*) from events where payload->>'marker' = ?", Integer.class, marker);
    }

    private int clientsWithPhone(String phone) {
        return jdbc.queryForObject(
                "select count(*) from clients where phone = ?", Integer.class, phone);
    }
}
