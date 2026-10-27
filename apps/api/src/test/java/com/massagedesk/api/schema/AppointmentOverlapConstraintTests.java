package com.massagedesk.api.schema;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** The database itself must make double booking impossible. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class AppointmentOverlapConstraintTests {

    @Autowired
    private JdbcTemplate jdbc;

    private UUID clientId;
    private UUID serviceId;

    @BeforeEach
    void setUp() {
        clientId = jdbc.queryForObject(
                "insert into clients (phone, name) values (?, ?) returning id", UUID.class, "+998900000001", "Test");
        serviceId = jdbc.queryForObject(
                "insert into services (name, duration_min, price) values (?, ?, ?) returning id",
                UUID.class, "Back massage", 60, 150000);
    }

    private void book(String from, String to, String status) {
        jdbc.update(
                "insert into appointments (client_id, service_id, period, status) "
                        + "values (?, ?, tstzrange(?::timestamptz, ?::timestamptz), ?)",
                clientId, serviceId, from, to, status);
    }

    @Test
    void rejectsOverlappingConfirmedAppointments() {
        book("2026-11-02 10:00+05", "2026-11-02 11:00+05", "confirmed");

        assertThatThrownBy(() -> book("2026-11-02 10:30+05", "2026-11-02 11:30+05", "confirmed"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("appointments_no_overlap");
    }

    @Test
    void allowsBackToBackAppointments() {
        book("2026-11-02 10:00+05", "2026-11-02 11:00+05", "confirmed");

        assertThatCode(() -> book("2026-11-02 11:00+05", "2026-11-02 12:00+05", "confirmed"))
                .doesNotThrowAnyException();
    }

    @Test
    void cancelledAppointmentFreesTheTime() {
        book("2026-11-02 10:00+05", "2026-11-02 11:00+05", "cancelled");

        assertThatCode(() -> book("2026-11-02 10:30+05", "2026-11-02 11:30+05", "confirmed"))
                .doesNotThrowAnyException();
    }
}
