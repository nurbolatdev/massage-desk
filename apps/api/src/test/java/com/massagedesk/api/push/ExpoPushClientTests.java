package com.massagedesk.api.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpHeaders.ACCEPT;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.headerDoesNotExist;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.massagedesk.api.push.PushSendException.Reason;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class ExpoPushClientTests {

    private static final String SEND_URL = "https://push.test/--/api/v2/push/send";
    private static final String ACCESS_TOKEN = "test-access-token";
    private static final String TOKEN_1 = "ExponentPushToken[token-alpha-111]";
    private static final String TOKEN_2 = "ExponentPushToken[token-beta-222]";
    private static final PushMessage SAMPLE_MESSAGE = new PushMessage(
            "Новая запись",
            "Завтра в 14:00 · Классический массаж",
            Map.of("appointmentId", "11111111-2222-3333-4444-555555555555"),
            "appointments");

    private final JsonMapper json = JsonMapper.builder().build();
    private RestClient.Builder builder;
    private MockRestServiceServer server;
    private ExpoPushClient client;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new ExpoPushClient(builder, props(SEND_URL, ACCESS_TOKEN), json);
    }

    @Test
    void sendsTwoTokensInOnePostWithBearerTokenAndReturnsTicketsInOrder() {
        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andExpect(header(AUTHORIZATION, "Bearer " + ACCESS_TOKEN))
                .andExpect(header(ACCEPT, APPLICATION_JSON.toString()))
                .andExpect(content().contentType(APPLICATION_JSON))
                .andExpect(request -> {
                    String body = ((MockClientHttpRequest) request).getBodyAsString();
                    assertThat(json.readTree(body)).isEqualTo(json.readTree("""
                            [
                              {
                                "to": "ExponentPushToken[token-alpha-111]",
                                "title": "Новая запись",
                                "body": "Завтра в 14:00 · Классический массаж",
                                "data": {
                                  "appointmentId": "11111111-2222-3333-4444-555555555555"
                                },
                                "channelId": "appointments",
                                "sound": "default",
                                "priority": "high"
                              },
                              {
                                "to": "ExponentPushToken[token-beta-222]",
                                "title": "Новая запись",
                                "body": "Завтра в 14:00 · Классический массаж",
                                "data": {
                                  "appointmentId": "11111111-2222-3333-4444-555555555555"
                                },
                                "channelId": "appointments",
                                "sound": "default",
                                "priority": "high"
                              }
                            ]
                            """));
                })
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {"status": "ok", "id": "ticket-1"},
                            {"status": "ok", "id": "ticket-2"}
                          ]
                        }
                        """, APPLICATION_JSON));

        List<PushTicket> tickets = client.send(List.of(TOKEN_1, TOKEN_2), SAMPLE_MESSAGE);

        assertThat(tickets).containsExactly(
                new PushTicket(true, null),
                new PushTicket(true, null));
        server.verify();
    }

    @Test
    void omitsAuthorizationHeaderWhenTokenIsEmptyAndOmitsEmptyDataAndNullChannelId() {
        RestClient.Builder noTokenBuilder = RestClient.builder();
        MockRestServiceServer noTokenServer = MockRestServiceServer.bindTo(noTokenBuilder).build();
        ExpoPushClient noTokenClient = new ExpoPushClient(noTokenBuilder, props(SEND_URL, ""), json);

        noTokenServer.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andExpect(headerDoesNotExist(AUTHORIZATION))
                .andExpect(header(ACCEPT, APPLICATION_JSON.toString()))
                .andExpect(content().contentType(APPLICATION_JSON))
                .andExpect(request -> {
                    JsonNode tree = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(tree).isEqualTo(json.readTree("""
                            [
                              {
                                "to": "ExponentPushToken[token-alpha-111]",
                                "title": "Новая запись",
                                "body": "Завтра в 14:00",
                                "sound": "default",
                                "priority": "high"
                              }
                            ]
                            """));
                    assertThat(tree.path(0).has("data")).isFalse();
                    assertThat(tree.path(0).has("channelId")).isFalse();
                })
                .andRespond(withSuccess("""
                        {"data": [{"status": "ok", "id": "ticket-1"}]}
                        """, APPLICATION_JSON));

        List<PushTicket> tickets = noTokenClient.send(
                List.of(TOKEN_1),
                new PushMessage("Новая запись", "Завтра в 14:00", Map.of(), null));

        assertThat(tickets).containsExactly(new PushTicket(true, null));
        noTokenServer.verify();
    }

    @Test
    void mapsMixedTicketsAndSanitizesTicketErrorCodes() {
        List<String> tokens = List.of(
                TOKEN_1,
                TOKEN_2,
                "ExponentPushToken[token-gamma-333]",
                "ExponentPushToken[token-delta-444]",
                "ExponentPushToken[token-epsilon-555]");

        server.expect(once(), requestTo(SEND_URL))
                .andExpect(method(POST))
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {"status": "ok", "id": "ticket-1"},
                            {
                              "status": "error",
                              "message": "\\\"ExponentPushToken[token-beta-222]\\\" is not a registered push notification recipient",
                              "details": {"error": "DeviceNotRegistered"}
                            },
                            {
                              "status": "error",
                              "message": " Too many messages ",
                              "details": {"error": "MessageRateExceeded"}
                            },
                            {"status": "weird"},
                            {
                              "status": "error",
                              "message": "bad error code",
                              "details": {"error": "bad value!"}
                            }
                          ]
                        }
                        """, APPLICATION_JSON));

        List<PushTicket> tickets = client.send(tokens, SAMPLE_MESSAGE);

        assertThat(tickets).hasSize(5);
        assertThat(tickets.get(0).ok()).isTrue();
        assertThat(tickets.get(0).error()).isNull();
        assertThat(tickets.get(0).deviceNotRegistered()).isFalse();

        assertThat(tickets.get(1).ok()).isFalse();
        assertThat(tickets.get(1).error()).isEqualTo("DeviceNotRegistered");
        assertThat(tickets.get(1).deviceNotRegistered()).isTrue();

        assertThat(tickets.get(2).ok()).isFalse();
        assertThat(tickets.get(2).error()).isEqualTo("MessageRateExceeded");
        assertThat(tickets.get(2).deviceNotRegistered()).isFalse();

        assertThat(tickets.get(3).ok()).isFalse();
        assertThat(tickets.get(3).error()).isNull();
        assertThat(tickets.get(3).deviceNotRegistered()).isFalse();

        assertThat(tickets.get(4).ok()).isFalse();
        assertThat(tickets.get(4).error()).isNull();
        assertThat(tickets.get(4).deviceNotRegistered()).isFalse();
        server.verify();
    }

    @Test
    void rejectsEmptyOrOverLimitTokenBatchesWithoutMakingHttpRequest() {
        assertThatThrownBy(() -> client.send(List.of(), SAMPLE_MESSAGE))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("push batch must have 1..100 tokens");
        server.verify();

        List<String> tooMany = Collections.nCopies(101, TOKEN_1);
        assertThatThrownBy(() -> client.send(tooMany, SAMPLE_MESSAGE))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("push batch must have 1..100 tokens");
        server.verify();
    }

    @Test
    void throwsNotConfiguredWithoutMakingHttpRequestWhenUrlIsEmpty() {
        RestClient.Builder unconfiguredBuilder = RestClient.builder();
        MockRestServiceServer unconfiguredServer = MockRestServiceServer.bindTo(unconfiguredBuilder).build();
        ExpoPushClient unconfiguredClient = new ExpoPushClient(
                unconfiguredBuilder,
                props("", ACCESS_TOKEN),
                json);

        assertThat(unconfiguredClient.configured()).isFalse();
        assertThatThrownBy(() -> unconfiguredClient.send(List.of(TOKEN_1), SAMPLE_MESSAGE))
                .isInstanceOf(PushSendException.class)
                .satisfies(ex -> {
                    PushSendException sendEx = (PushSendException) ex;
                    assertThat(sendEx.reason()).isEqualTo(Reason.NOT_CONFIGURED);
                    assertThat(sendEx.httpStatus()).isZero();
                    assertThat(sendEx.errorCode()).isNull();
                    assertThat(sendEx.getMessage()).isEqualTo("push request failed: NOT_CONFIGURED");
                    assertNoSensitiveData(sendEx);
                });
        unconfiguredServer.verify();
    }

    @Test
    void maps400WithRequestErrorCodeToRejectedWithoutLeakingTokenFromErrorMessage() {
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withStatus(BAD_REQUEST)
                        .contentType(APPLICATION_JSON)
                        .body("""
                                {
                                  "errors": [
                                    {
                                      "code": "PUSH_TOO_MANY_EXPERIENCE_IDS",
                                      "message": "All push notification messages in the same request must be for the same project; saw ExponentPushToken[abc] and %s"
                                    }
                                  ]
                                }
                                """.formatted(TOKEN_1)));

        assertSendFails(Reason.REJECTED, 400, "PUSH_TOO_MANY_EXPERIENCE_IDS");
        server.verify();
    }

    @Test
    void maps401And403ToUnauthorizedAnd429ToRateLimitedAnd5xxToUnavailable() {
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withStatus(UNAUTHORIZED)
                        .contentType(APPLICATION_JSON)
                        .body("""
                                {"errors":[{"code":"UNAUTHORIZED","message":"Invalid access token test-access-token"}]}
                                """));
        assertSendFails(Reason.UNAUTHORIZED, 401, "UNAUTHORIZED");
        server.verify();

        server.reset();
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withStatus(FORBIDDEN)
                        .contentType(APPLICATION_JSON)
                        .body("""
                                {"errors":[{"code":"ACCESS_DENIED","message":"Forbidden"}]}
                                """));
        assertSendFails(Reason.UNAUTHORIZED, 403, "ACCESS_DENIED");
        server.verify();

        server.reset();
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withStatus(TOO_MANY_REQUESTS));
        assertSendFails(Reason.RATE_LIMITED, 429, null);
        server.verify();

        server.reset();
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withStatus(INTERNAL_SERVER_ERROR).body("internal error"));
        assertSendFails(Reason.UNAVAILABLE, 500, null);
        server.verify();

        server.reset();
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withStatus(SERVICE_UNAVAILABLE));
        assertSendFails(Reason.UNAVAILABLE, 503, null);
        server.verify();
    }

    @Test
    void maps400WithNonJsonOrInvalidErrorCodeToRejectedWithNullCode() {
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withStatus(BAD_REQUEST).body("bad gateway html"));
        assertSendFails(Reason.REJECTED, 400, null);
        server.verify();

        server.reset();
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withStatus(BAD_REQUEST)
                        .contentType(APPLICATION_JSON)
                        .body("""
                                {"errors":[{"code":"bad code with spaces!","message":"ExponentPushToken[abc]"}]}
                                """));
        assertSendFails(Reason.REJECTED, 400, null);
        server.verify();
    }

    @Test
    void mapsSocketTimeoutAndConnectExceptionToUnavailable() {
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withException(new SocketTimeoutException("read timed out")));

        assertThatThrownBy(() -> client.send(List.of(TOKEN_1), SAMPLE_MESSAGE))
                .isInstanceOf(PushSendException.class)
                .satisfies(ex -> {
                    PushSendException sendEx = (PushSendException) ex;
                    assertThat(sendEx.reason()).isEqualTo(Reason.UNAVAILABLE);
                    assertThat(sendEx.httpStatus()).isZero();
                    assertThat(sendEx.errorCode()).isNull();
                    assertThat(sendEx.getCause()).isNotNull();
                    assertThat(sendEx.getMessage()).isEqualTo("push request failed: UNAVAILABLE");
                    assertNoSensitiveData(sendEx);
                });
        server.verify();

        server.reset();
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withException(new ConnectException("connection refused")));

        assertThatThrownBy(() -> client.send(List.of(TOKEN_1), SAMPLE_MESSAGE))
                .isInstanceOf(PushSendException.class)
                .satisfies(ex -> {
                    PushSendException sendEx = (PushSendException) ex;
                    assertThat(sendEx.reason()).isEqualTo(Reason.UNAVAILABLE);
                    assertThat(sendEx.httpStatus()).isZero();
                    assertThat(sendEx.errorCode()).isNull();
                    assertThat(sendEx.getCause()).isNotNull();
                    assertThat(sendEx.getMessage()).isEqualTo("push request failed: UNAVAILABLE");
                    assertNoSensitiveData(sendEx);
                });
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "",
            "   ",
            "not json",
            "{}",
            "{\"data\":{}}",
            "{\"data\":[{\"status\":\"ok\"}]}"
    })
    void maps200WithMalformedBodyOrCountMismatchToInvalidResponse(String invalidBody) {
        server.expect(once(), requestTo(SEND_URL))
                .andRespond(withSuccess(invalidBody, APPLICATION_JSON));

        assertThatThrownBy(() -> client.send(List.of(TOKEN_1, TOKEN_2), SAMPLE_MESSAGE))
                .isInstanceOf(PushSendException.class)
                .satisfies(ex -> {
                    PushSendException sendEx = (PushSendException) ex;
                    assertThat(sendEx.reason()).isEqualTo(Reason.INVALID_RESPONSE);
                    assertThat(sendEx.httpStatus()).isEqualTo(200);
                    assertThat(sendEx.errorCode()).isNull();
                    assertThat(sendEx.getMessage()).isEqualTo("push request failed: INVALID_RESPONSE (HTTP 200)");
                    assertNoSensitiveData(sendEx);
                });
        server.verify();
    }

    private void assertSendFails(
            Reason expectedReason,
            int expectedStatus,
            @Nullable String expectedCode) {
        assertThatThrownBy(() -> client.send(List.of(TOKEN_1), SAMPLE_MESSAGE))
                .isInstanceOf(PushSendException.class)
                .satisfies(ex -> {
                    PushSendException sendEx = (PushSendException) ex;
                    assertThat(sendEx.reason()).isEqualTo(expectedReason);
                    assertThat(sendEx.httpStatus()).isEqualTo(expectedStatus);
                    assertThat(sendEx.errorCode()).isEqualTo(expectedCode);
                    String expectedMessage = "push request failed: "
                            + expectedReason
                            + " (HTTP " + expectedStatus + ")"
                            + (expectedCode != null ? " " + expectedCode : "");
                    assertThat(sendEx.getMessage()).isEqualTo(expectedMessage);
                    assertNoSensitiveData(sendEx);
                });
    }

    private static void assertNoSensitiveData(Throwable ex) {
        assertThat(ex.getMessage())
                .doesNotContain("ExponentPushToken")
                .doesNotContain(ACCESS_TOKEN)
                .doesNotContain(TOKEN_1)
                .doesNotContain(TOKEN_2)
                .doesNotContain(SAMPLE_MESSAGE.title())
                .doesNotContain(SAMPLE_MESSAGE.body());
    }

    private static PushProperties props(String url, String token) {
        return new PushProperties(
                url,
                token,
                Duration.ofSeconds(5),
                Duration.ofSeconds(10));
    }
}
