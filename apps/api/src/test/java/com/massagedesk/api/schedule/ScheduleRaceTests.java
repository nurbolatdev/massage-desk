package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.security.StaffRole;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

/**
 * A booking and a time off for the same hours, sent at the same moment, must never both succeed.
 * Allowed outcomes: the booking wins (201) and the time off answers 409 listing that appointment,
 * or the time off wins (201) and the booking answers 422. The invariant is checked in SQL after
 * every round. Deliberately not {@code @Transactional}: each request needs its own connection and
 * transaction. {@code ScheduleLockTests} is the deterministic proof that both writes share one
 * lock; this class shows the end-to-end behaviour and may not reproduce a missing lock reliably.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
class ScheduleRaceTests {

    private static final int ROUNDS = 30;
    private static final String PHONE = "+998900000867";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository hours;

    private UUID clientId;
    private UUID serviceId;

    @BeforeEach
    void setUp() {
        hours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)));
        clientId = clients.saveAndFlush(new Client(PHONE, "Race client")).getId();
        serviceId = services.saveAndFlush(new MassageService("Race", 60, new BigDecimal("100000.00"), 1)).getId();
    }

    @AfterEach
    void cleanUp() {
        deleteRound();
        jdbc.update("delete from clients where id = ?", clientId);
        jdbc.update("delete from services where id = ?", serviceId);
        jdbc.update("delete from events where type in ('time_off_created', 'time_off_deleted', 'working_hours_replaced')");
        jdbc.update("delete from time_off");
        jdbc.update("delete from working_hours");
    }

    private void deleteRound() {
        jdbc.update("delete from events where entity_id in (select id from appointments where client_id = ?)", clientId);
        jdbc.update("delete from appointments where client_id = ?", clientId);
        jdbc.update("delete from events where type in ('time_off_created', 'time_off_deleted', 'working_hours_replaced')");
        jdbc.update("delete from time_off");
    }

    private MockHttpServletResponse send(String path, String json) throws Exception {
        return mvc.perform(post(path)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json)
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))))
                .andReturn()
                .getResponse();
    }

    @Test
    void bookingAndTimeOffNeverBothWin() throws Exception {
        String bookingJson = "{\"clientId\":\"%s\",\"serviceId\":\"%s\",\"start\":\"2026-11-03T12:00:00+05:00\"}"
                .formatted(clientId, serviceId);
        String timeOffJson = "{\"start\":\"2026-11-03T11:00:00+05:00\",\"end\":\"2026-11-03T13:00:00+05:00\"}";
        int bookingWon = 0;
        int timeOffWon = 0;
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < ROUNDS; round++) {
                CountDownLatch start = new CountDownLatch(1);
                Callable<MockHttpServletResponse> book = () -> {
                    start.await();
                    return send("/appointments", bookingJson);
                };
                Callable<MockHttpServletResponse> block = () -> {
                    start.await();
                    return send("/time-off", timeOffJson);
                };
                Future<MockHttpServletResponse> booking = pool.submit(book);
                Future<MockHttpServletResponse> timeOff = pool.submit(block);
                start.countDown();
                MockHttpServletResponse bookingResponse = booking.get(30, TimeUnit.SECONDS);
                MockHttpServletResponse timeOffResponse = timeOff.get(30, TimeUnit.SECONDS);

                if (bookingResponse.getStatus() == 201) {
                    assertThat(timeOffResponse.getStatus()).as("round %d: time off after a booking", round).isEqualTo(409);
                    String bookedId = JsonPath.read(bookingResponse.getContentAsString(), "$.id");
                    String conflictId = JsonPath.read(timeOffResponse.getContentAsString(), "$.conflicts[0].appointmentId");
                    assertThat(conflictId).isEqualTo(bookedId);
                    bookingWon++;
                } else {
                    assertThat(timeOffResponse.getStatus()).as("round %d: time off first", round).isEqualTo(201);
                    assertThat(bookingResponse.getStatus()).isEqualTo(422);
                    assertThat((String) JsonPath.read(bookingResponse.getContentAsString(), "$.detail"))
                            .isEqualTo("time is outside working hours, in time off or in the past");
                    timeOffWon++;
                }

                Integer overlapping = jdbc.queryForObject("""
                        select count(*) from appointments a join time_off t on a.period && t.period
                        where a.status = 'confirmed'
                        """, Integer.class);
                assertThat(overlapping).as("round %d: confirmed appointment inside time off", round).isZero();
                deleteRound();
            }
        } finally {
            pool.shutdownNow();
        }
        assertThat(bookingWon + timeOffWon).isEqualTo(ROUNDS);
    }
}
