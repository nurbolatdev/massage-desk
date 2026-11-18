package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.Appointment;
import com.massagedesk.api.booking.AppointmentRepository;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.EventActor;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class ServiceCatalogTests {

    @Autowired
    private ServiceCatalog catalog;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    @Autowired
    private SlotService slotService;

    @Autowired
    private AppointmentRepository appointments;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void createAppendsAfterCurrentMaxSortOrder() {
        int max = services.maxSortOrder();

        MassageService created = catalog.create("  Appended  ", 60, new BigDecimal("1000.50"), null, EventActor.MASTER);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getName()).isEqualTo("Appended");
        assertThat(created.getSortOrder()).isEqualTo(max + 1);
        assertThat(created.isActive()).isTrue();
        assertThat(catalog.all()).extracting(MassageService::getId).contains(created.getId());
    }

    @Test
    void explicitSortOrderIsKept() {
        MassageService created = catalog.create("Explicit", 45, new BigDecimal("500"), 7, EventActor.MASTER);

        assertThat(created.getSortOrder()).isEqualTo(7);
    }

    @Test
    void updateChangesEachField() {
        MassageService created = catalog.create("Before", 60, new BigDecimal("100"), 3, EventActor.MASTER);

        MassageService updated = catalog.update(created.getId(), " After ", 90, new BigDecimal("250.25"), 9, false, EventActor.MASTER);

        assertThat(updated.getName()).isEqualTo("After");
        assertThat(updated.getDurationMin()).isEqualTo(90);
        assertThat(updated.getPrice()).isEqualByComparingTo("250.25");
        assertThat(updated.getSortOrder()).isEqualTo(9);
        assertThat(updated.isActive()).isFalse();
    }

    @Test
    void nullLeavesFieldsUnchanged() {
        MassageService created = catalog.create("Same", 60, new BigDecimal("100"), 3, EventActor.MASTER);

        MassageService updated = catalog.update(created.getId(), null, null, null, null, null, EventActor.MASTER);

        assertThat(updated.getName()).isEqualTo("Same");
        assertThat(updated.getDurationMin()).isEqualTo(60);
        assertThat(updated.getPrice()).isEqualByComparingTo("100");
        assertThat(updated.getSortOrder()).isEqualTo(3);
        assertThat(updated.isActive()).isTrue();
    }

    @Test
    void deactivatedServiceHasNoFreeTimeAndCanBeReactivated() {
        jdbc.update("delete from working_hours");
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(12, 0)));
        MassageService created = catalog.create("Toggle", 60, new BigDecimal("100"), null, EventActor.MASTER);
        LocalDate day = LocalDate.parse("2026-11-03");
        assertThat(slotService.freeStarts(created.getId(), day)).isPresent();

        catalog.update(created.getId(), null, null, null, null, false, EventActor.MASTER);

        assertThat(services.findByIdAndActiveTrue(created.getId())).isEmpty();
        assertThat(slotService.freeStarts(created.getId(), day)).isEmpty();

        catalog.update(created.getId(), null, null, null, null, true, EventActor.MASTER);

        assertThat(services.findByIdAndActiveTrue(created.getId())).isPresent();
        assertThat(slotService.freeStarts(created.getId(), day).orElseThrow().starts()).isNotEmpty();
    }

    @Test
    void unknownServiceIsNotFound() {
        UUID id = UUID.randomUUID();

        assertThatThrownBy(() -> catalog.update(id, "x", null, null, null, null, EventActor.MASTER))
                .isInstanceOfSatisfying(ScheduleException.class, e -> {
                    assertThat(e.reason()).isEqualTo(ScheduleException.Reason.SERVICE_NOT_FOUND);
                    assertThat(e).hasMessage("service not found");
                });
    }

    @Test
    void entityRefusesInvalidValues() {
        MassageService service = new MassageService("Rules", 60, new BigDecimal("10"), 0);

        assertThatThrownBy(() -> service.changeDuration(0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.changePrice(new BigDecimal("-1")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void existingAppointmentKeepsItsPeriodAfterDurationChange() {
        MassageService created = catalog.create("Longer", 60, new BigDecimal("100"), null, EventActor.MASTER);
        Client client = clients.saveAndFlush(new Client("+998900000841", "Catalog client"));
        Appointment appointment = appointments.saveAndFlush(new Appointment(client, created,
                new TimeRange(Instant.parse("2026-11-03T08:00:00Z"), Instant.parse("2026-11-03T09:00:00Z")),
                AppointmentSource.MANUAL));

        catalog.update(created.getId(), null, 120, null, null, null, EventActor.MASTER);
        entityManager.flush();

        Long minutes = jdbc.queryForObject(
                "select extract(epoch from (upper(period) - lower(period)))::bigint / 60 from appointments"
                        + " where id = ?", Long.class, appointment.getId());
        assertThat(minutes).isEqualTo(60L);
    }
}
