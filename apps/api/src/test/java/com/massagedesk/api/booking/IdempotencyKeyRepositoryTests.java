package com.massagedesk.api.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.TimeRange;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class IdempotencyKeyRepositoryTests {

    private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000201");
    private static final UUID OTHER_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000202");
    private static final UUID KEY = UUID.fromString("10000000-0000-0000-0000-000000000201");
    private static final UUID OTHER_KEY = UUID.fromString("10000000-0000-0000-0000-000000000202");
    private static final Instant CREATED_AT = Instant.parse("2026-11-02T05:15:00Z");

    @Autowired
    private IdempotencyKeyRepository keys;

    @Autowired
    private AppointmentRepository appointments;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    private Client client;
    private MassageService service;
    private Appointment appointment;

    @BeforeEach
    void saveAppointment() {
        client = clients.saveAndFlush(new Client("+998900000202", "Idempotency test client"));
        service = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
        appointment = appointments.saveAndFlush(new Appointment(
                client,
                service,
                new TimeRange(Instant.parse("2026-11-03T05:00:00Z"), Instant.parse("2026-11-03T06:00:00Z")),
                AppointmentSource.MANUAL));
    }

    @Test
    void savesAndFindsByUserAndKey() {
        keys.saveAndFlush(new IdempotencyKey(
                USER_ID, KEY, appointment.getId(), client.getId(), service.getId(), appointment.getPeriod(), CREATED_AT));
        entityManager.clear();

        IdempotencyKey found = keys.findByUserIdAndIdempotencyKey(USER_ID, KEY).orElseThrow();
        assertThat(found.getAppointmentId()).isEqualTo(appointment.getId());
        assertThat(found.getClientId()).isEqualTo(client.getId());
        assertThat(found.getServiceId()).isEqualTo(service.getId());
        assertThat(found.period()).isEqualTo(appointment.getPeriod());
        assertThat(keys.findByUserIdAndIdempotencyKey(OTHER_USER_ID, KEY)).isEmpty();
    }

    @Test
    void databaseRejectsDuplicateUserAndKey() {
        keys.saveAndFlush(new IdempotencyKey(
                USER_ID, KEY, appointment.getId(), client.getId(), service.getId(), appointment.getPeriod(), CREATED_AT));
        IdempotencyKey duplicate = new IdempotencyKey(
                USER_ID, KEY, appointment.getId(), client.getId(), service.getId(), appointment.getPeriod(), CREATED_AT);

        assertThatThrownBy(() -> keys.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class)
                .rootCause()
                .hasMessageContaining("idempotency_keys_user_key");
    }

    @Test
    void deletesOnlyKeysCreatedBeforeCutoff() {
        keys.saveAndFlush(new IdempotencyKey(
                USER_ID, KEY, appointment.getId(), client.getId(), service.getId(),
                appointment.getPeriod(), CREATED_AT.minusSeconds(1)));
        keys.saveAndFlush(new IdempotencyKey(
                USER_ID, OTHER_KEY, appointment.getId(), client.getId(), service.getId(),
                appointment.getPeriod(), CREATED_AT));
        entityManager.clear();

        int deleted = keys.deleteCreatedBefore(CREATED_AT);
        entityManager.clear();

        assertThat(deleted).isEqualTo(1);
        assertThat(keys.findByUserIdAndIdempotencyKey(USER_ID, KEY)).isEmpty();
        assertThat(keys.findByUserIdAndIdempotencyKey(USER_ID, OTHER_KEY)).isPresent();
    }

    @Test
    void deletingAppointmentCascadesToItsKey() {
        keys.saveAndFlush(new IdempotencyKey(
                USER_ID, KEY, appointment.getId(), client.getId(), service.getId(), appointment.getPeriod(), CREATED_AT));
        entityManager.clear();

        jdbc.update("delete from appointments where id = ?", appointment.getId());
        entityManager.clear();

        assertThat(keys.findByUserIdAndIdempotencyKey(USER_ID, KEY)).isEmpty();
    }

    @Test
    void matchesSameRequestAcrossOffsetsAndMicrosecondPrecision() {
        Instant start = Instant.parse("2026-11-03T05:00:00.123456Z");
        TimeRange period = new TimeRange(start, Instant.parse("2026-11-03T06:00:00Z"));
        keys.saveAndFlush(new IdempotencyKey(
                USER_ID, KEY, appointment.getId(), client.getId(), service.getId(), period, CREATED_AT));
        entityManager.clear();

        IdempotencyKey loaded = keys.findByUserIdAndIdempotencyKey(USER_ID, KEY).orElseThrow();

        Instant sameInstantOtherOffset = OffsetDateTime.parse("2026-11-03T10:00:00.123456+05:00").toInstant();
        Instant sameMicrosDifferentNanos = Instant.parse("2026-11-03T05:00:00.123456789Z");

        assertThat(loaded.sameRequest(client.getId(), service.getId(), sameInstantOtherOffset)).isTrue();
        assertThat(loaded.sameRequest(client.getId(), service.getId(), sameMicrosDifferentNanos)).isTrue();
        assertThat(loaded.sameRequest(UUID.randomUUID(), service.getId(), start)).isFalse();
        assertThat(loaded.sameRequest(client.getId(), UUID.randomUUID(), start)).isFalse();
        assertThat(loaded.sameRequest(client.getId(), service.getId(), start.plusSeconds(60))).isFalse();
    }
}
