package com.massagedesk.api.bot;

import static com.massagedesk.api.bot.BotConversations.bot;
import static com.massagedesk.api.bot.BotConversations.buttonIds;
import static com.massagedesk.api.bot.BotConversations.cleanUp;
import static com.massagedesk.api.bot.BotConversations.clientIdOf;
import static com.massagedesk.api.bot.BotConversations.conversation;
import static com.massagedesk.api.bot.BotConversations.reply;
import static com.massagedesk.api.bot.BotConversations.requestJson;
import static com.massagedesk.api.bot.BotConversations.rowIds;
import static com.massagedesk.api.bot.BotConversations.text;
import static com.massagedesk.api.messaging.TestOutboundMessages.MESSAGES_URL;
import static com.massagedesk.api.messaging.TestOutboundMessages.accepted;
import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.booking.Appointment;
import com.massagedesk.api.booking.AppointmentRepository;
import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.booking.AppointmentStatus;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.TestOutboundMessages;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.TimeRange;
import com.massagedesk.api.schedule.WorkingHours;
import com.massagedesk.api.schedule.WorkingHoursRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class BookingBotMenuTests {

    private static final Instant FIRST_START = Instant.parse("2026-11-03T05:00:00Z");
    private static final Instant SECOND_START = Instant.parse("2026-11-10T07:00:00Z");
    private static final Instant PAST_START = Instant.parse("2026-11-02T03:00:00Z");

    @Autowired private ApplicationContext context;
    @Autowired private BotSessionStore sessions;
    @Autowired private AppointmentService appointments;
    @Autowired private AppointmentRepository appointmentRepository;
    @Autowired private MassageServiceRepository serviceRepository;
    @Autowired private WorkingHoursRepository workingHoursRepository;
    @Autowired private ClientRepository clients;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JdbcClient jdbcClient;
    @Autowired private Clock clock;
    @Autowired private JsonMapper json;

    private MockRestServiceServer server;
    private BookingBot bot;
    private MassageService service;
    private UUID serviceId;
    private UUID hoursId;

    @BeforeEach
    void setUp() {
        cleanUp(jdbc);
        hoursId = workingHoursRepository
                .saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)))
                .getId();
        service = serviceRepository
                .saveAndFlush(new MassageService("Классический массаж", 60, new BigDecimal("8000.00"), 1));
        serviceId = service.getId();

        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        bot = bot(context, TestOutboundMessages.create(jdbcClient, builder, json, clock));
    }

    @AfterEach
    void tearDown() {
        cleanUp(jdbc);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from working_hours where id = ?", hoursId);
    }

    @Test
    void greetingWithoutUpcomingAppointmentsRepliesWithPlainMenu() {
        UUID id = conversation(clients, jdbc, "+998900001201");
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("interactive").path("body").path("text").asString())
                            .isEqualTo(BotReplies.MENU_TEXT);
                    assertThat(buttonIds(body)).containsExactly("book");
                })
                .andRespond(withSuccess(accepted("wamid.bot-menu-empty"), APPLICATION_JSON));

        bot.on(text(jdbc, id, "Здравствуйте"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
    }

    @Test
    void menuListsOnlyOwnUpcomingConfirmedAppointmentsInMasterZoneAndCancelOpensPickList() {
        UUID id = conversation(clients, jdbc, "+998900001202");
        UUID clientId = clientIdOf(jdbc, id);
        Client client = clients.findById(clientId).orElseThrow();
        Client other = clients.saveAndFlush(new Client("+998900001208", "Other client"));

        UUID firstId = appointments
                .create(clientId, serviceId, FIRST_START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        UUID secondId = appointments
                .create(clientId, serviceId, SECOND_START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        saveDirect(client, PAST_START, AppointmentStatus.CONFIRMED);
        saveDirect(client, Instant.parse("2026-11-17T05:00:00Z"), AppointmentStatus.CANCELLED);
        appointments.create(
                other.getId(),
                serviceId,
                Instant.parse("2026-11-03T08:00:00Z"),
                AppointmentSource.MANUAL,
                EventActor.MASTER);

        String expectedMenuText = """
                Здравствуйте! Я помогу записаться на массаж.

                Ваши записи:
                Вторник, 3 ноября, 10:00 — Классический массаж
                Вторник, 10 ноября, 12:00 — Классический массаж""";

        for (int attempt = 1; attempt <= 2; attempt++) {
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> {
                        JsonNode body = requestJson(json, request);
                        assertThat(body.path("interactive").path("body").path("text").asString())
                                .isEqualTo(expectedMenuText);
                        assertThat(buttonIds(body)).containsExactly("book", "cancel");
                    })
                    .andRespond(withSuccess(accepted("wamid.bot-menu-upcoming-" + attempt), APPLICATION_JSON));
        }
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("interactive").path("type").asString()).isEqualTo("list");
                    assertThat(body.path("interactive").path("body").path("text").asString())
                            .isEqualTo("Какую запись отменить?");
                    assertThat(body.path("interactive").path("action").path("button").asString())
                            .isEqualTo("Выбрать запись");
                    assertThat(rowIds(body))
                            .containsExactly("appointment:" + firstId, "appointment:" + secondId);
                })
                .andRespond(withSuccess(accepted("wamid.bot-cancel-picks"), APPLICATION_JSON));

        bot.on(text(jdbc, id, "Здравствуйте"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());

        bot.on(reply(jdbc, id, "move"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());

        bot.on(reply(jdbc, id, "cancel"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.CANCEL_PICK, null, null, null, null));
    }

    @Test
    void staleCancelButtonWithoutUpcomingAppointmentsRepliesWithNoUpcomingAndStaysInMenu() {
        UUID id = conversation(clients, jdbc, "+998900001203");
        sessions.save(id, BotSession.menu(), NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = requestJson(json, request);
                    assertThat(body.path("interactive").path("body").path("text").asString())
                            .isEqualTo(BotReplies.NO_UPCOMING_TEXT);
                    assertThat(buttonIds(body)).containsExactly("book");
                })
                .andRespond(withSuccess(accepted("wamid.bot-no-upcoming"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "cancel"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(BotSession.menu());
    }

    @Test
    void cancelPickRepeatsListForForeignPastCancelledOrFreeTextAndReturnsToMenuForOwnAppointment() {
        UUID id = conversation(clients, jdbc, "+998900001204");
        UUID clientId = clientIdOf(jdbc, id);
        Client client = clients.findById(clientId).orElseThrow();
        Client other = clients.saveAndFlush(new Client("+998900001208", "Other client"));

        UUID ownId = appointments
                .create(clientId, serviceId, FIRST_START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        UUID foreignId = appointments
                .create(
                        other.getId(),
                        serviceId,
                        Instant.parse("2026-11-03T08:00:00Z"),
                        AppointmentSource.MANUAL,
                        EventActor.MASTER)
                .id();
        UUID pastId = saveDirect(client, PAST_START, AppointmentStatus.CONFIRMED).getId();
        UUID cancelledId = saveDirect(
                        client, Instant.parse("2026-11-10T05:00:00Z"), AppointmentStatus.CANCELLED)
                .getId();

        BotSession pickSession = new BotSession(Step.CANCEL_PICK, null, null, null, null);
        sessions.save(id, pickSession, NOW.minus(Duration.ofMinutes(1)));

        for (int attempt = 1; attempt <= 4; attempt++) {
            server.expect(requestTo(MESSAGES_URL))
                    .andExpect(method(POST))
                    .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                            .containsExactly("appointment:" + ownId))
                    .andRespond(withSuccess(accepted("wamid.bot-pick-repeat-" + attempt), APPLICATION_JSON));
        }
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(buttonIds(requestJson(json, request)))
                        .containsExactly("cancel_confirm:" + ownId, "keep"))
                .andRespond(withSuccess(accepted("wamid.bot-pick-own-confirm"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "appointment:" + foreignId));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(pickSession);

        bot.on(reply(jdbc, id, "appointment:" + pastId));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(pickSession);

        bot.on(reply(jdbc, id, "appointment:" + cancelledId));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(pickSession);

        bot.on(text(jdbc, id, "привет"));
        assertThat(sessions.load(id).orElseThrow().session()).isEqualTo(pickSession);

        assertThat(appointmentRepository.findById(ownId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(appointmentRepository.findById(foreignId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(appointmentRepository.findById(pastId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);
        assertThat(appointmentRepository.findById(cancelledId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CANCELLED);

        bot.on(reply(jdbc, id, "appointment:" + ownId));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session())
                .isEqualTo(new BotSession(Step.CANCEL_CONFIRM, null, null, null, ownId));
    }

    @Test
    void bookButtonOnCancelPickOpensServiceListAndKeepsAppointment() {
        UUID id = conversation(clients, jdbc, "+998900001205");
        UUID appointmentId = appointments
                .create(clientIdOf(jdbc, id), serviceId, FIRST_START, AppointmentSource.MANUAL, EventActor.MASTER)
                .id();
        sessions.save(
                id,
                new BotSession(Step.CANCEL_PICK, null, null, null, null),
                NOW.minus(Duration.ofMinutes(1)));
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(request -> assertThat(rowIds(requestJson(json, request)))
                        .contains("service:" + serviceId))
                .andRespond(withSuccess(accepted("wamid.bot-pick-book"), APPLICATION_JSON));

        bot.on(reply(jdbc, id, "book"));

        server.verify();
        assertThat(sessions.load(id).orElseThrow().session().step()).isEqualTo(Step.SERVICE);
        assertThat(appointmentRepository.findById(appointmentId).orElseThrow().getStatus())
                .isEqualTo(AppointmentStatus.CONFIRMED);
    }

    private Appointment saveDirect(Client forClient, Instant start, AppointmentStatus status) {
        Appointment appointment = new Appointment(
                forClient,
                service,
                new TimeRange(start, start.plus(Duration.ofHours(1))),
                AppointmentSource.MANUAL);
        if (status == AppointmentStatus.CANCELLED) {
            appointment.cancel();
        }
        return appointmentRepository.saveAndFlush(appointment);
    }
}
