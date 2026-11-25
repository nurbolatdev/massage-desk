package com.massagedesk.api.bot;

import static com.massagedesk.api.bot.BotConversations.cleanUp;
import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.bot.BotReplies.Upcoming;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.OutboundMessage.ListMenu;
import com.massagedesk.api.messaging.OutboundMessage.Row;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.SlotService;
import com.massagedesk.api.schedule.WorkingHours;
import com.massagedesk.api.schedule.WorkingHoursRepository;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class BotListsMoveTests {

    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 3);
    private static final Instant START = Instant.parse("2026-11-03T05:00:00Z");

    @Autowired private BotLists lists;
    @Autowired private AppointmentChanges changes;
    @Autowired private AppointmentService appointments;
    @Autowired private SlotService slots;
    @Autowired private MassageServiceRepository serviceRepository;
    @Autowired private WorkingHoursRepository workingHoursRepository;
    @Autowired private ClientRepository clients;
    @Autowired private JdbcTemplate jdbc;

    private UUID hoursId;
    private UUID serviceId;
    private UUID appointmentId;
    private Upcoming item;

    @BeforeEach
    void setUp() {
        cleanUp(jdbc);
        hoursId = workingHoursRepository
                .saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)))
                .getId();
        serviceId = serviceRepository
                .saveAndFlush(new MassageService("Классический массаж", 60, new BigDecimal("8000.00"), 1))
                .getId();
        UUID clientId = clients.saveAndFlush(new Client("+998900001201", "Bot client")).getId();
        appointmentId = appointments
                .create(clientId, serviceId, START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        item = changes.own(appointmentId, clientId).orElseThrow();
    }

    @AfterEach
    void tearDown() {
        cleanUp(jdbc);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from working_hours where id = ?", hoursId);
    }

    @Test
    void moveStartsFreesOwnTimeExcludesCurrentStartAndRespectsBookedLengthAndCompetitors() {
        assertThat(item)
                .isEqualTo(new Upcoming(appointmentId, serviceId, "Классический массаж", START));
        assertThat(lists.moveStarts(item, TUESDAY))
                .contains(List.of(
                        Instant.parse("2026-11-03T05:30:00Z"),
                        Instant.parse("2026-11-03T06:00:00Z"),
                        Instant.parse("2026-11-03T06:30:00Z"),
                        Instant.parse("2026-11-03T07:00:00Z"),
                        Instant.parse("2026-11-03T07:30:00Z"),
                        Instant.parse("2026-11-03T08:00:00Z"),
                        Instant.parse("2026-11-03T08:30:00Z"),
                        Instant.parse("2026-11-03T09:00:00Z"),
                        Instant.parse("2026-11-03T09:30:00Z"),
                        Instant.parse("2026-11-03T10:00:00Z")));

        Client competitor = clients.saveAndFlush(new Client("+998900001209", "Competitor"));
        appointments.create(
                competitor.getId(),
                serviceId,
                Instant.parse("2026-11-03T07:00:00Z"),
                AppointmentSource.MANUAL,
                EventActor.MASTER);
        assertThat(lists.moveStarts(item, TUESDAY))
                .contains(List.of(
                        Instant.parse("2026-11-03T05:30:00Z"),
                        Instant.parse("2026-11-03T06:00:00Z"),
                        Instant.parse("2026-11-03T08:00:00Z"),
                        Instant.parse("2026-11-03T08:30:00Z"),
                        Instant.parse("2026-11-03T09:00:00Z"),
                        Instant.parse("2026-11-03T09:30:00Z"),
                        Instant.parse("2026-11-03T10:00:00Z")));

        Instant lastSixtyMinStart = Instant.parse("2026-11-03T10:00:00Z");
        jdbc.update("update services set duration_min = 90 where id = ?", serviceId);
        assertThat(lists.moveStarts(item, TUESDAY).orElseThrow()).contains(lastSixtyMinStart);
        assertThat(slots.freeStarts(serviceId, TUESDAY).orElseThrow().starts())
                .doesNotContain(lastSixtyMinStart);

        jdbc.update("update services set active = false where id = ?", serviceId);
        assertThat(lists.moveDayList(item, null)).isPresent();
        assertThat(slots.freeStarts(serviceId, TUESDAY)).isEmpty();
    }

    @Test
    void moveDayListAndMoveTimeListBuildMoveSessionsAndPaginateTimesWithoutCurrentStart() {
        assertThat(jdbc.queryForObject("select count(*) from working_hours", Integer.class))
                .isEqualTo(1);

        Turn dayTurn = lists.moveDayList(item, null).orElseThrow();
        assertThat(dayTurn.next())
                .isEqualTo(new BotSession(Step.DAY, null, null, null, appointmentId));
        assertThat(dayTurn.replies()).hasSize(1);
        ListMenu dayMenu = (ListMenu) dayTurn.replies().getFirst();
        assertThat(dayMenu.body()).isEqualTo("Выберите день.");
        assertThat(dayMenu.rows())
                .extracting(Row::id)
                .containsExactly(
                        "day:2026-11-03",
                        "day:2026-11-10",
                        "day:2026-11-17",
                        "day:2026-11-24",
                        "day:2026-12-01");

        Turn timeTurn = lists.moveTimeList(item, TUESDAY, null, null).orElseThrow();
        assertThat(timeTurn.next())
                .isEqualTo(new BotSession(Step.TIME, null, TUESDAY, null, appointmentId));
        assertThat(timeTurn.replies()).hasSize(1);
        ListMenu timeMenu = (ListMenu) timeTurn.replies().getFirst();
        assertThat(timeMenu.body()).isEqualTo("Вторник, 3 ноября. Выберите время.");
        assertThat(timeMenu.rows())
                .extracting(Row::id)
                .containsExactly(
                        "time:2026-11-03T05:30:00Z",
                        "time:2026-11-03T06:00:00Z",
                        "time:2026-11-03T06:30:00Z",
                        "time:2026-11-03T07:00:00Z",
                        "time:2026-11-03T07:30:00Z",
                        "time:2026-11-03T08:00:00Z",
                        "time:2026-11-03T08:30:00Z",
                        "time:2026-11-03T09:00:00Z",
                        "more_times:2026-11-03T09:00:00Z",
                        "other_day");
        assertThat(timeMenu.rows().getFirst().title()).isEqualTo("10:30");
    }
}
