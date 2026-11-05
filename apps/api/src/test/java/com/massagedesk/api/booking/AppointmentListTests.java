package com.massagedesk.api.booking;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.AppointmentService.AppointmentListView;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.TimeRange;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class AppointmentListTests {

    private static final LocalDate NOV_3 = LocalDate.of(2026, 11, 3);
    private static final LocalDate NOV_4 = LocalDate.of(2026, 11, 4);

    @Autowired
    private AppointmentService service;

    @Autowired
    private AppointmentRepository appointments;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    private Client client;
    private MassageService classic;

    @BeforeEach
    void setUp() {
        client = clients.saveAndFlush(new Client("+998900000701", "Aigul"));
        classic = services.saveAndFlush(new MassageService("Classic", 60, new BigDecimal("100000.00"), 1));
    }

    private Appointment save(Client forClient, String start, String end) {
        return appointments.saveAndFlush(new Appointment(forClient, classic,
                new TimeRange(Instant.parse(start), Instant.parse(end)), AppointmentSource.MANUAL));
    }

    @Test
    void returnsAppointmentWithClientAndServiceNames() {
        Appointment saved = save(client, "2026-11-03T05:00:00Z", "2026-11-03T06:00:00Z");

        List<AppointmentListView> found = service.between(NOV_3, NOV_3);

        assertThat(found).hasSize(1);
        AppointmentListView item = found.get(0);
        assertThat(item.appointment().id()).isEqualTo(saved.getId());
        assertThat(item.appointment().period().start()).isEqualTo(Instant.parse("2026-11-03T05:00:00Z"));
        assertThat(item.clientName()).isEqualTo("Aigul");
        assertThat(item.clientPhone()).isEqualTo("+998900000701");
        assertThat(item.serviceName()).isEqualTo("Classic");
    }

    @Test
    void dayBoundariesFollowTheMastersZone() {
        save(client, "2026-11-02T18:30:00Z", "2026-11-02T19:00:00Z"); // 23:30 +05:00 on 11-02
        save(client, "2026-11-03T19:00:00Z", "2026-11-03T20:00:00Z"); // 00:00 +05:00 on 11-04

        assertThat(service.between(NOV_3, NOV_3)).isEmpty();
    }

    @Test
    void returnsCancelledAppointments() {
        Appointment saved = save(client, "2026-11-03T05:00:00Z", "2026-11-03T06:00:00Z");
        saved.cancel();
        appointments.saveAndFlush(saved);

        List<AppointmentListView> found = service.between(NOV_3, NOV_3);

        assertThat(found).hasSize(1);
        assertThat(found.get(0).appointment().status()).isEqualTo(AppointmentStatus.CANCELLED);
    }

    @Test
    void ordersByStart() {
        Appointment late = save(client, "2026-11-03T09:00:00Z", "2026-11-03T10:00:00Z");
        Appointment early = save(client, "2026-11-03T05:00:00Z", "2026-11-03T06:00:00Z");

        List<AppointmentListView> found = service.between(NOV_3, NOV_3);

        assertThat(found).extracting(v -> v.appointment().id()).containsExactly(early.getId(), late.getId());
    }

    @Test
    void clientWithoutNameHasNullName() {
        Client unnamed = clients.saveAndFlush(new Client("+998900000702", null));
        save(unnamed, "2026-11-03T05:00:00Z", "2026-11-03T06:00:00Z");

        List<AppointmentListView> found = service.between(NOV_3, NOV_3);

        assertThat(found).hasSize(1);
        assertThat(found.get(0).clientName()).isNull();
        assertThat(found.get(0).clientPhone()).isEqualTo("+998900000702");
    }

    @Test
    void rangeCoversBothDays() {
        save(client, "2026-11-03T05:00:00Z", "2026-11-03T06:00:00Z");
        save(client, "2026-11-04T05:00:00Z", "2026-11-04T06:00:00Z");

        assertThat(service.between(NOV_3, NOV_4)).hasSize(2);
        assertThat(service.between(NOV_4, NOV_4)).hasSize(1);
    }
}
