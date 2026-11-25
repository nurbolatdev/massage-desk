package com.massagedesk.api.booking;

import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.AppointmentService.AppointmentListView;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.TimeRange;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class UpcomingAppointmentsTests {

    @Autowired private AppointmentService service;
    @Autowired private AppointmentRepository appointments;
    @Autowired private ClientRepository clients;
    @Autowired private MassageServiceRepository services;

    private Client client;
    private Client otherClient;
    private MassageService classic;

    @BeforeEach
    void setUp() {
        client = clients.saveAndFlush(new Client("+998900001301", "Upcoming client"));
        otherClient = clients.saveAndFlush(new Client("+998900001302", "Other client"));
        classic = services.saveAndFlush(
                new MassageService("Классический массаж", 60, new BigDecimal("8000.00"), 1));
    }

    @Test
    void returnsOnlyOwnConfirmedAppointmentsStartingStrictlyAfterNowOrderedByStart() {
        Appointment plusTwoDays = save(client, NOW.plus(Duration.ofDays(2)));
        Appointment plusOneDay = save(client, NOW.plus(Duration.ofDays(1)));
        save(client, NOW);
        save(client, NOW.minus(Duration.ofHours(2)));
        Appointment cancelledFuture = save(client, NOW.plus(Duration.ofDays(3)));
        cancelledFuture.cancel();
        appointments.saveAndFlush(cancelledFuture);
        save(otherClient, NOW.plus(Duration.ofHours(3)));

        List<AppointmentListView> found = service.upcomingOfClient(client.getId(), 10);

        assertThat(found)
                .extracting(v -> v.appointment().id())
                .containsExactly(plusOneDay.getId(), plusTwoDays.getId());
        assertThat(found)
                .allSatisfy(v -> {
                    assertThat(v.serviceName()).isEqualTo("Классический массаж");
                    assertThat(v.appointment().zone()).isEqualTo(ZoneId.of("Asia/Tashkent"));
                    assertThat(v.appointment().status()).isEqualTo(AppointmentStatus.CONFIRMED);
                });

        assertThat(service.upcomingOfClient(client.getId(), 1))
                .extracting(v -> v.appointment().id())
                .containsExactly(plusOneDay.getId());
        assertThat(service.upcomingOfClient(UUID.randomUUID(), 10)).isEmpty();
        assertThatThrownBy(() -> service.upcomingOfClient(client.getId(), 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private Appointment save(Client forClient, Instant start) {
        return appointments.saveAndFlush(new Appointment(
                forClient,
                classic,
                new TimeRange(start, start.plus(Duration.ofHours(1))),
                AppointmentSource.MANUAL));
    }
}
