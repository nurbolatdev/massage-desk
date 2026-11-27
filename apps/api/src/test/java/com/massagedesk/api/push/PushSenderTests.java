package com.massagedesk.api.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.massagedesk.api.TestcontainersConfiguration;
import java.net.SocketTimeoutException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
@ExtendWith(OutputCaptureExtension.class)
class PushSenderTests {

    private static final String SEND_URL = "https://push.test/send";
    private static final String TOKEN_1 = "ExponentPushToken[sender-token-alpha-001]";
    private static final String TOKEN_2 = "ExponentPushToken[sender-token-beta-002]";
    private static final PushMessage SAMPLE_MESSAGE = new PushMessage(
            "Новая запись от клиента",
            "Secret client note and body text",
            Map.of("appointmentId", "11111111-2222-3333-4444-555555555555"),
            "appointments");

    @Autowired
    private DeviceStore store;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private JsonMapper json;

    private RestClient.Builder builder;
    private MockRestServiceServer server;
    private PushSender sender;
    private Instant nextCreatedAt;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        sender = new PushSender(
                store,
                new ExpoPushClient(builder, new PushProperties(SEND_URL, "", null, null), json));
        nextCreatedAt = Instant.parse("2026-01-01T00:00:00Z");
    }

    @Test
    void notConfiguredWithTwoDevicesMakesNoRequestAndThrowsNothing() {
        UUID userId = insertProfile("master");
        registerDevice(userId, TOKEN_1);
        registerDevice(userId, TOKEN_2);

        RestClient.Builder offBuilder = RestClient.builder();
        MockRestServiceServer offServer = MockRestServiceServer.bindTo(offBuilder).build();
        PushSender offSender = new PushSender(
                store,
                new ExpoPushClient(offBuilder, new PushProperties("", "", null, null), json));

        assertThatNoException().isThrownBy(() -> offSender.sendToAllDevices(SAMPLE_MESSAGE));

        offServer.verify();
        assertThat(store.tokens()).containsExactly(TOKEN_1, TOKEN_2);
    }

    @Test
    void noDevicesMakesNoRequest() {
        assertThatNoException().isThrownBy(() -> sender.sendToAllDevices(SAMPLE_MESSAGE));

        server.verify();
    }

    @Test
    void twoDevicesBothOkSendsOnePostWithBothTokensAndKeepsRows() {
        UUID userId = insertProfile("master");
        registerDevice(userId, TOKEN_1);
        registerDevice(userId, TOKEN_2);

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(body.isArray()).isTrue();
                    assertThat(body.size()).isEqualTo(2);
                    assertThat(body.path(0).path("to").asString()).isEqualTo(TOKEN_1);
                    assertThat(body.path(1).path("to").asString()).isEqualTo(TOKEN_2);
                })
                .andRespond(withSuccess(okTicketsResponse(2), APPLICATION_JSON));

        sender.sendToAllDevices(SAMPLE_MESSAGE);

        server.verify();
        assertThat(store.tokens()).containsExactly(TOKEN_1, TOKEN_2);
    }

    @Test
    void oneHundredFiftyDevicesSendsTwoBatchesOfOneHundredAndFifty() {
        UUID userId = insertProfile("master");
        List<String> allTokens = registerManyDevices(userId, 150);

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(body.size()).isEqualTo(100);
                    assertThat(body.path(0).path("to").asString()).isEqualTo(allTokens.get(0));
                    assertThat(body.path(99).path("to").asString()).isEqualTo(allTokens.get(99));
                })
                .andRespond(withSuccess(okTicketsResponse(100), APPLICATION_JSON));

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andExpect(request -> {
                    JsonNode body = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(body.size()).isEqualTo(50);
                    assertThat(body.path(0).path("to").asString()).isEqualTo(allTokens.get(100));
                    assertThat(body.path(49).path("to").asString()).isEqualTo(allTokens.get(149));
                })
                .andRespond(withSuccess(okTicketsResponse(50), APPLICATION_JSON));

        sender.sendToAllDevices(SAMPLE_MESSAGE);

        server.verify();
        assertThat(store.tokens()).hasSize(150);
    }

    @Test
    void deviceNotRegisteredTicketDeletesThatDeviceKeepsTheOtherAndLogsCountsOnly(CapturedOutput output) {
        UUID userId = insertProfile("master");
        registerDevice(userId, TOKEN_1);
        registerDevice(userId, TOKEN_2);

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {"status": "ok", "id": "ticket-1"},
                            {
                              "status": "error",
                              "message": "\\"%s\\" is not a registered push notification recipient",
                              "details": {"error": "DeviceNotRegistered"}
                            }
                          ]
                        }
                        """.formatted(TOKEN_2), APPLICATION_JSON));

        sender.sendToAllDevices(SAMPLE_MESSAGE);

        server.verify();
        assertThat(store.tokens()).containsExactly(TOKEN_1);
        assertThat(output.getOut())
                .contains("push sent: 1 ok, 1 failed ({DeviceNotRegistered=1}), 1 devices removed")
                .doesNotContain(TOKEN_1)
                .doesNotContain(TOKEN_2)
                .doesNotContain("ExponentPushToken")
                .doesNotContain(SAMPLE_MESSAGE.title())
                .doesNotContain(SAMPLE_MESSAGE.body());
    }

    @Test
    void messageRateExceededTicketKeepsRowAndLogsItsCode(CapturedOutput output) {
        UUID userId = insertProfile("master");
        registerDevice(userId, TOKEN_1);

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {
                              "status": "error",
                              "message": "Rate limit exceeded for %s",
                              "details": {"error": "MessageRateExceeded"}
                            }
                          ]
                        }
                        """.formatted(TOKEN_1), APPLICATION_JSON));

        sender.sendToAllDevices(SAMPLE_MESSAGE);

        server.verify();
        assertThat(store.tokens()).containsExactly(TOKEN_1);
        assertThat(output.getOut())
                .contains("push sent: 0 ok, 1 failed ({MessageRateExceeded=1}), 0 devices removed")
                .doesNotContain(TOKEN_1);
    }

    @Test
    void firstBatch503StillSendsSecondBatchKeepsAllRowsAndLogsCountsOnly(CapturedOutput output) {
        UUID userId = insertProfile("master");
        List<String> allTokens = registerManyDevices(userId, 150);

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andRespond(withStatus(SERVICE_UNAVAILABLE)
                        .contentType(APPLICATION_JSON)
                        .body("""
                                {"errors":[{"code":"SERVICE_UNAVAILABLE","message":"Failed for %s"}]}
                                """.formatted(allTokens.get(0))));

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess(okTicketsResponse(50), APPLICATION_JSON));

        assertThatNoException().isThrownBy(() -> sender.sendToAllDevices(SAMPLE_MESSAGE));

        server.verify();
        assertThat(store.tokens()).hasSize(150);
        assertThat(output.getOut())
                .contains("push batch of 100 failed: push request failed: UNAVAILABLE (HTTP 503) SERVICE_UNAVAILABLE")
                .contains("push sent: 50 ok, 100 failed ({request=100}), 0 devices removed")
                .doesNotContain(allTokens.get(0))
                .doesNotContain("ExponentPushToken")
                .doesNotContain(SAMPLE_MESSAGE.title())
                .doesNotContain(SAMPLE_MESSAGE.body());
    }

    @Test
    void socketTimeoutThrowsNothingAndKeepsRows() {
        UUID userId = insertProfile("master");
        registerDevice(userId, TOKEN_1);
        registerDevice(userId, TOKEN_2);

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andRespond(withException(new SocketTimeoutException("read timed out")));

        assertThatNoException().isThrownBy(() -> sender.sendToAllDevices(SAMPLE_MESSAGE));

        server.verify();
        assertThat(store.tokens()).containsExactly(TOKEN_1, TOKEN_2);
    }

    @Test
    void malformed200BodyThrowsNothingAndKeepsRows() {
        UUID userId = insertProfile("master");
        registerDevice(userId, TOKEN_1);
        registerDevice(userId, TOKEN_2);

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess("not-valid-json", APPLICATION_JSON));

        assertThatNoException().isThrownBy(() -> sender.sendToAllDevices(SAMPLE_MESSAGE));

        server.verify();
        assertThat(store.tokens()).containsExactly(TOKEN_1, TOKEN_2);
    }

    @Test
    void nullMessageThrowsNothingAndMakesNoRequest() {
        UUID userId = insertProfile("master");
        registerDevice(userId, TOKEN_1);

        assertThatNoException().isThrownBy(() -> sender.sendToAllDevices(null));

        server.verify();
        assertThat(store.tokens()).containsExactly(TOKEN_1);
    }

    @Test
    void storeFailuresAreCaughtAndLoggedByExceptionClassOnly(CapturedOutput output) {
        DeviceStore failingLoadStore = mock(DeviceStore.class);
        when(failingLoadStore.tokens()).thenThrow(new IllegalStateException("secret-db-error " + TOKEN_1));
        PushSender failingLoadSender = new PushSender(
                failingLoadStore,
                new ExpoPushClient(builder, new PushProperties(SEND_URL, "", null, null), json));

        assertThatNoException().isThrownBy(() -> failingLoadSender.sendToAllDevices(SAMPLE_MESSAGE));
        server.verify();

        DeviceStore failingForgetStore = mock(DeviceStore.class);
        when(failingForgetStore.tokens()).thenReturn(List.of(TOKEN_1));
        when(failingForgetStore.forget(any())).thenThrow(new IllegalStateException("secret-forget-error " + TOKEN_1));
        PushSender failingForgetSender = new PushSender(
                failingForgetStore,
                new ExpoPushClient(builder, new PushProperties(SEND_URL, "", null, null), json));

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {
                              "status": "error",
                              "message": "unregistered",
                              "details": {"error": "DeviceNotRegistered"}
                            }
                          ]
                        }
                        """, APPLICATION_JSON));

        assertThatNoException().isThrownBy(() -> failingForgetSender.sendToAllDevices(SAMPLE_MESSAGE));
        server.verify();
        assertThat(output.getOut())
                .contains("java.lang.IllegalStateException")
                .doesNotContain("secret-db-error")
                .doesNotContain("secret-forget-error")
                .doesNotContain(TOKEN_1);
    }

    private UUID insertProfile(String role) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into profiles (user_id, role, display_name) values (?, ?, 'Staff')", id, role);
        return id;
    }

    private void registerDevice(UUID userId, String token) {
        UUID id = store.register(userId, token);
        jdbc.update(
                "update devices set created_at = ? where id = ?",
                Timestamp.from(nextCreatedAt),
                id);
        nextCreatedAt = nextCreatedAt.plusSeconds(1);
    }

    private List<String> registerManyDevices(UUID userId, int count) {
        List<String> tokens = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            String token = "ExponentPushToken[batch-token-%03d]".formatted(i);
            registerDevice(userId, token);
            tokens.add(token);
        }
        return List.copyOf(tokens);
    }

    private String okTicketsResponse(int count) {
        ObjectNode root = json.createObjectNode();
        ArrayNode data = root.putArray("data");
        for (int i = 0; i < count; i++) {
            ObjectNode ticket = data.addObject();
            ticket.put("status", "ok");
            ticket.put("id", "ticket-" + i);
        }
        return json.writeValueAsString(root);
    }
}
