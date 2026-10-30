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
class AppointmentRepositoryTests {

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

    @BeforeEach
    void saveClientAndService() {
        client = clients.saveAndFlush(new Client("+998900000201", "Test client"));
        service = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
    }

    private static TimeRange range(String start, String end) {
        return new TimeRange(Instant.parse(start), Instant.parse(end));
    }

    @Test
    void savesAppointmentAndReadsItBack() {
        TimeRange period = range("2026-11-02T05:00:00Z", "2026-11-02T06:00:00Z");
        Appointment saved = appointments.saveAndFlush(
                new Appointment(client, service, period, AppointmentSource.MANUAL));
        entityManager.clear();

        Appointment found = appointments.findById(saved.getId()).orElseThrow();

        assertThat(found.getStatus()).isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(found.getSource()).isEqualTo(AppointmentSource.MANUAL);
        assertThat(found.getPeriod()).isEqualTo(period);
        assertThat(found.getClient().getId()).isEqualTo(client.getId());
        assertThat(found.getCreatedAt()).isNotNull();
        String status = jdbc.queryForObject(
                "select status from appointments where id = ?", String.class, saved.getId());
        String source = jdbc.queryForObject(
                "select source from appointments where id = ?", String.class, saved.getId());
        assertThat(status).isEqualTo("confirmed");
        assertThat(source).isEqualTo("manual");
    }

    @Test
    void databaseRejectsOverlappingConfirmedAppointment() {
        appointments.saveAndFlush(new Appointment(client, service,
                range("2026-11-02T05:00:00Z", "2026-11-02T06:00:00Z"), AppointmentSource.MANUAL));
        Appointment overlapping = new Appointment(client, service,
                range("2026-11-02T05:30:00Z", "2026-11-02T06:30:00Z"), AppointmentSource.BOT);

        assertThatThrownBy(() -> appointments.saveAndFlush(overlapping))
                .isInstanceOf(DataIntegrityViolationException.class)
                .rootCause()
                .hasMessageContaining("appointments_no_overlap");
    }

    @Test
    void acceptsBackToBackAppointments() {
        appointments.saveAndFlush(new Appointment(client, service,
                range("2026-11-02T05:00:00Z", "2026-11-02T06:00:00Z"), AppointmentSource.MANUAL));

        Appointment next = appointments.saveAndFlush(new Appointment(client, service,
                range("2026-11-02T06:00:00Z", "2026-11-02T07:00:00Z"), AppointmentSource.MANUAL));

        assertThat(next.getId()).isNotNull();
    }

    @Test
    void readsStatusInsertedWithSql() {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into appointments (id, client_id, service_id, period, status)
                values (?, ?, ?, tstzrange('2026-11-02 10:00+05', '2026-11-02 11:00+05'), 'no_show')
                """, id, client.getId(), service.getId());
        entityManager.clear();

        Appointment found = appointments.findById(id).orElseThrow();

        assertThat(found.getStatus()).isEqualTo(AppointmentStatus.NO_SHOW);
    }

    @Test
    void databaseAcceptsEveryStatusWrittenByConverter() {
        AppointmentStatusConverter converter = new AppointmentStatusConverter();
        int hour = 0;
        for (AppointmentStatus status : AppointmentStatus.values()) {
            String start = String.format("2026-11-03T%02d:00:00Z", hour);
            String end = String.format("2026-11-03T%02d:00:00Z", hour + 1);
            hour += 2;
            jdbc.update("""
                    insert into appointments (id, client_id, service_id, period, status)
                    values (?, ?, ?, tstzrange(?::timestamptz, ?::timestamptz), ?)
                    """, UUID.randomUUID(), client.getId(), service.getId(), start, end,
                    converter.convertToDatabaseColumn(status));
        }

        Integer count = jdbc.queryForObject(
                "select count(*) from appointments where client_id = ?", Integer.class, client.getId());
        assertThat(count).isEqualTo(AppointmentStatus.values().length);
    }
}
