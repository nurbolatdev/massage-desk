package com.massagedesk.api.errors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.MassageServiceRepository;
import com.massagedesk.api.schedule.WorkingHours;
import com.massagedesk.api.schedule.WorkingHoursRepository;
import com.massagedesk.api.security.StaffRole;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Every domain rule that can refuse a request answers a problem detail with the same shape and a code. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class ProblemResponsesTests {

    private static final String TUESDAY_10 = "2026-11-03T10:00:00+05:00";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private MassageServiceRepository services;

    @Autowired
    private WorkingHoursRepository workingHours;

    private Client client;
    private MassageService service;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from working_hours");
        jdbc.update("delete from time_off");
        workingHours.saveAndFlush(new WorkingHours(DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(16, 0)));
        client = clients.saveAndFlush(new Client("+998900000876", "Problem client"));
        service = services.saveAndFlush(new MassageService("Problem service", 60, new BigDecimal("100000.00"), 1));
    }

    private ResultActions send(MockHttpServletRequestBuilder request, String json) throws Exception {
        MockHttpServletRequestBuilder builder = request.with(jwt()
                .authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority())));
        if (json != null) {
            builder = builder.contentType(MediaType.APPLICATION_JSON).content(json);
        }
        return mvc.perform(builder);
    }

    private static void assertDocumentedMembers(ResultActions result) throws Exception {
        String json = result.andReturn().getResponse().getContentAsString();
        Map<String, Object> parsed = JsonPath.read(json, "$");
        Set<String> documented = Arrays.stream(ApiProblem.class.getRecordComponents())
                .map(RecordComponent::getName).collect(Collectors.toSet());
        Set<String> required = Set.of("title", "status", "detail", "instance", "code");
        assertThat(documented).containsAll(parsed.keySet());
        assertThat(parsed.keySet()).containsAll(required);
    }

    private static ResultActions problem(ResultActions result, int status, String title, String detail,
            String instance, String code) throws Exception {
        assertDocumentedMembers(result);
        return result
                .andExpect(status().is(status))
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.title").value(title))
                .andExpect(jsonPath("$.status").value(status))
                .andExpect(jsonPath("$.detail").value(detail))
                .andExpect(jsonPath("$.instance").value(instance))
                .andExpect(jsonPath("$.code").value(code));
    }

    private String booking(String clientId, String start) {
        return "{\"clientId\":\"%s\",\"serviceId\":\"%s\",\"start\":\"%s\"}"
                .formatted(clientId, service.getId(), start);
    }

    private String book(String start) throws Exception {
        String json = send(post("/appointments"), booking(client.getId().toString(), start))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(json, "$.id");
    }

    @Test
    void bookingClientNotFound() throws Exception {
        problem(send(post("/appointments"), booking(UUID.randomUUID().toString(), TUESDAY_10)),
                404, "Not Found", "client not found", "/appointments", "CLIENT_NOT_FOUND");
    }

    @Test
    void bookingTimeTaken() throws Exception {
        book(TUESDAY_10);
        problem(send(post("/appointments"), booking(client.getId().toString(), TUESDAY_10)),
                409, "Conflict", "time is already booked", "/appointments", "TIME_TAKEN");
    }

    @Test
    void bookingNotConfirmed() throws Exception {
        String id = book(TUESDAY_10);
        send(post("/appointments/" + id + "/cancel"), null).andExpect(status().isOk());
        problem(send(post("/appointments/" + id + "/cancel"), null),
                409, "Conflict", "appointment is cancelled", "/appointments/" + id + "/cancel", "NOT_CONFIRMED");
    }

    @Test
    void bookingOutsideSchedule() throws Exception {
        problem(send(post("/appointments"), booking(client.getId().toString(), "2026-11-03T20:00:00+05:00")),
                422, "Unprocessable Content", "time is outside working hours, in time off or in the past",
                "/appointments", "OUTSIDE_SCHEDULE");
    }

    @Test
    void clientInvalidPhone() throws Exception {
        problem(send(post("/clients"), "{\"phone\":\"12345\"}"),
                400, "Bad Request", "invalid phone number", "/clients", "INVALID_PHONE");
    }

    @Test
    void clientNotFound() throws Exception {
        String id = UUID.randomUUID().toString();
        problem(send(get("/clients/" + id), null),
                404, "Not Found", "client not found", "/clients/" + id, "CLIENT_NOT_FOUND");
    }

    @Test
    void clientPhoneTaken() throws Exception {
        problem(send(post("/clients"), "{\"phone\":\"+998900000876\"}"),
                409, "Conflict", "client with this phone already exists", "/clients", "PHONE_TAKEN");
    }

    @Test
    void scheduleServiceNotFound() throws Exception {
        String id = UUID.randomUUID().toString();
        problem(send(patch("/services/" + id), "{\"name\":\"X\"}"),
                404, "Not Found", "service not found", "/services/" + id, "SERVICE_NOT_FOUND");
    }

    @Test
    void scheduleTimeOffNotFound() throws Exception {
        String id = UUID.randomUUID().toString();
        problem(send(delete("/time-off/" + id), null),
                404, "Not Found", "time off not found", "/time-off/" + id, "TIME_OFF_NOT_FOUND");
    }

    @Test
    void scheduleInvalidTimeOff() throws Exception {
        problem(send(post("/time-off"), "{\"start\":\"" + TUESDAY_10 + "\",\"end\":\"" + TUESDAY_10 + "\"}"),
                422, "Unprocessable Content", "time off must start before it ends", "/time-off",
                "INVALID_TIME_OFF");
    }

    @Test
    void scheduleInvalidHours() throws Exception {
        problem(send(put("/working-hours"),
                "{\"blocks\":[{\"weekday\":1,\"start\":\"13:00\",\"end\":\"09:00\"}]}"),
                422, "Unprocessable Content", "block must start before it ends", "/working-hours",
                "INVALID_HOURS");
    }

    @Test
    void scheduleAppointmentConflict() throws Exception {
        book(TUESDAY_10);
        problem(send(post("/time-off"),
                "{\"start\":\"2026-11-03T00:00:00+05:00\",\"end\":\"2026-11-04T00:00:00+05:00\"}"),
                409, "Conflict", "time off overlaps confirmed appointments", "/time-off",
                "APPOINTMENT_CONFLICT")
                .andExpect(jsonPath("$.conflicts.length()").value(1));
    }

    @Test
    void slotsServiceNotFound() throws Exception {
        problem(send(get("/slots?serviceId=" + UUID.randomUUID() + "&day=2026-11-03"), null),
                404, "Not Found", "service not found", "/slots", "SERVICE_NOT_FOUND");
    }

    @Test
    void bookingServiceNotFound() throws Exception {
        String json = "{\"clientId\":\"%s\",\"serviceId\":\"%s\",\"start\":\"%s\"}"
                .formatted(client.getId(), UUID.randomUUID(), TUESDAY_10);
        problem(send(post("/appointments"), json),
                404, "Not Found", "service not found", "/appointments", "SERVICE_NOT_FOUND");
    }

    @Test
    void bookingAppointmentNotFound() throws Exception {
        String id = UUID.randomUUID().toString();
        problem(send(post("/appointments/" + id + "/cancel"), null),
                404, "Not Found", "appointment not found", "/appointments/" + id + "/cancel",
                "APPOINTMENT_NOT_FOUND");
    }

    @Test
    void bookingNotStarted() throws Exception {
        String id = book(TUESDAY_10);
        problem(send(post("/appointments/" + id + "/no-show"), null),
                409, "Conflict", "appointment has not started yet", "/appointments/" + id + "/no-show",
                "NOT_STARTED");
    }

    @Test
    void malformedJson() throws Exception {
        frameworkProblem(send(post("/appointments"), "{"), 400, "Bad Request", "/appointments");
    }

    @Test
    void beanValidation() throws Exception {
        frameworkProblem(send(post("/appointments"), "{}"), 400, "Bad Request", "/appointments");
    }

    @Test
    void invalidId() throws Exception {
        frameworkProblem(send(post("/appointments/not-a-uuid/cancel"), null), 400, "Bad Request",
                "/appointments/not-a-uuid/cancel");
    }

    @Test
    void missingParameter() throws Exception {
        frameworkProblem(send(get("/slots?day=2026-11-03"), null), 400, "Bad Request", "/slots");
    }

    @Test
    void timeOffRangeCheck() throws Exception {
        frameworkProblem(send(get("/time-off?from=2026-11-05&to=2026-11-03"), null), 400, "Bad Request",
                "/time-off")
                .andExpect(jsonPath("$.detail").value("from must not be after to"));
    }

    @Test
    void unknownPath() throws Exception {
        frameworkProblem(send(get("/no-such-path"), null), 404, "Not Found", "/no-such-path");
    }

    @Test
    void unsupportedMediaType() throws Exception {
        ResultActions result = mvc.perform(post("/appointments")
                .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority())))
                .contentType(MediaType.TEXT_PLAIN).content("x"));
        frameworkProblem(result, 415, "Unsupported Media Type", "/appointments");
    }

    @Test
    void methodNotAllowed() throws Exception {
        String id = UUID.randomUUID().toString();
        frameworkProblem(send(get("/appointments/" + id + "/cancel"), null), 405, "Method Not Allowed",
                "/appointments/" + id + "/cancel");
    }

    @Test
    void notAcceptable() throws Exception {
        frameworkProblem(send(get("/clients").accept(MediaType.TEXT_PLAIN), null), 406, "Not Acceptable",
                "/clients");
    }

    @Test
    void oneExceptionHandlerBean() {
        assertThat(context.getBeansOfType(ResponseEntityExceptionHandler.class).values())
                .hasSize(1)
                .allSatisfy(handler -> assertThat(handler.getClass().getSimpleName())
                        .isEqualTo("DomainErrorHandler"));
    }

    private static ResultActions frameworkProblem(ResultActions result, int status, String title, String instance)
            throws Exception {
        assertDocumentedMembers(result);
        return result
                .andExpect(status().is(status))
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.title").value(title))
                .andExpect(jsonPath("$.status").value(status))
                .andExpect(jsonPath("$.detail").exists())
                .andExpect(jsonPath("$.instance").value(instance))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void settingsUnknownTimeZone() throws Exception {
        problem(send(patch("/settings"), "{\"timeZone\":\"Nowhere/City\"}"),
                400, "Bad Request", "unknown time zone", "/settings", "UNKNOWN_TIME_ZONE");
    }
}
