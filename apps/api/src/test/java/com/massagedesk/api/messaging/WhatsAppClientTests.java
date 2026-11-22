package com.massagedesk.api.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpHeaders.ACCEPT;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.massagedesk.api.messaging.OutboundMessage.Button;
import com.massagedesk.api.messaging.OutboundMessage.Buttons;
import com.massagedesk.api.messaging.OutboundMessage.ListMenu;
import com.massagedesk.api.messaging.OutboundMessage.Row;
import com.massagedesk.api.messaging.OutboundMessage.Template;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import com.massagedesk.api.messaging.WhatsAppSendException.Reason;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class WhatsAppClientTests {

    private static final String BASE_URL = "https://graph.test/v99.0";
    private static final String ACCESS_TOKEN = "test-token";
    private static final String PHONE_NUMBER_ID = "123456";
    private static final String MESSAGES_URL = "https://graph.test/v99.0/123456/messages";
    private static final String RECIPIENT_E164 = "+998901234567";
    private static final String RECIPIENT_DIGITS = "998901234567";
    private static final String SAMPLE_BODY = "Запись подтверждена на 14:00";

    private final JsonMapper json = JsonMapper.builder().build();
    private RestClient.Builder builder;
    private MockRestServiceServer server;
    private WhatsAppClient client;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new WhatsAppClient(builder, props(BASE_URL, ACCESS_TOKEN, PHONE_NUMBER_ID), json);
    }

    @Test
    void sendsTextMessageAndReturnsWhatsAppMessageId() {
        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(header(AUTHORIZATION, "Bearer test-token"))
                .andExpect(header(ACCEPT, APPLICATION_JSON.toString()))
                .andExpect(content().contentType(APPLICATION_JSON))
                .andExpect(request -> {
                    String body = ((MockClientHttpRequest) request).getBodyAsString();
                    assertThat(json.readTree(body)).isEqualTo(json.readTree("""
                            {
                              "messaging_product": "whatsapp",
                              "recipient_type": "individual",
                              "to": "998901234567",
                              "type": "text",
                              "text": {
                                "preview_url": false,
                                "body": "Запись подтверждена на 14:00"
                              }
                            }
                            """));
                })
                .andRespond(withSuccess("""
                        {
                          "messaging_product": "whatsapp",
                          "contacts": [{"input": "998901234567", "wa_id": "998901234567"}],
                          "messages": [{"id": "wamid.TEST1"}]
                        }
                        """, APPLICATION_JSON));

        String messageId = client.send(RECIPIENT_E164, new Text(SAMPLE_BODY));

        assertThat(messageId).isEqualTo("wamid.TEST1");
        server.verify();
    }

    @Test
    void sendsButtonsMessageAndReturnsId() {
        Buttons buttons = new Buttons(
                "Выберите действие",
                List.of(new Button("confirm", "Подтвердить"), new Button("cancel", "Отменить")));

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(header(AUTHORIZATION, "Bearer test-token"))
                .andExpect(content().contentType(APPLICATION_JSON))
                .andExpect(request -> {
                    JsonNode tree = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(tree.path("type").asString()).isEqualTo("interactive");
                    assertThat(tree.path("interactive").path("type").asString()).isEqualTo("button");
                    assertThat(tree.path("interactive").path("action").path("buttons")).hasSize(2);
                })
                .andRespond(withSuccess("""
                        {"messaging_product":"whatsapp","messages":[{"id":"wamid.BTN1"}]}
                        """, APPLICATION_JSON));

        String messageId = client.send(RECIPIENT_E164, buttons);

        assertThat(messageId).isEqualTo("wamid.BTN1");
        server.verify();
    }

    @Test
    void sendsListMenuMessageAndReturnsId() {
        ListMenu listMenu = new ListMenu(
                "Выберите услугу",
                "Услуги",
                List.of(new Row("classic-60", "Классический массаж", "60 минут")));

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(header(AUTHORIZATION, "Bearer test-token"))
                .andExpect(content().contentType(APPLICATION_JSON))
                .andExpect(request -> {
                    JsonNode tree = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(tree.path("type").asString()).isEqualTo("interactive");
                    assertThat(tree.path("interactive").path("type").asString()).isEqualTo("list");
                    assertThat(tree.path("interactive").path("action").path("button").asString())
                            .isEqualTo("Услуги");
                })
                .andRespond(withSuccess("""
                        {"messaging_product":"whatsapp","messages":[{"id":"wamid.LIST1"}]}
                        """, APPLICATION_JSON));

        String messageId = client.send(RECIPIENT_E164, listMenu);

        assertThat(messageId).isEqualTo("wamid.LIST1");
        server.verify();
    }

    @Test
    void sendsTemplateMessageAndReturnsId() {
        Template template = new Template("booking_reminder", "ru", List.of("Азиза", "14:00"));

        server.expect(requestTo(MESSAGES_URL))
                .andExpect(method(POST))
                .andExpect(header(AUTHORIZATION, "Bearer test-token"))
                .andExpect(content().contentType(APPLICATION_JSON))
                .andExpect(request -> {
                    JsonNode tree = json.readTree(((MockClientHttpRequest) request).getBodyAsString());
                    assertThat(tree.path("type").asString()).isEqualTo("template");
                    assertThat(tree.path("template").path("name").asString()).isEqualTo("booking_reminder");
                    assertThat(tree.path("template").path("language").path("code").asString()).isEqualTo("ru");
                })
                .andRespond(withSuccess("""
                        {"messaging_product":"whatsapp","messages":[{"id":"wamid.TPL1"}]}
                        """, APPLICATION_JSON));

        String messageId = client.send(RECIPIENT_E164, template);

        assertThat(messageId).isEqualTo("wamid.TPL1");
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(ints = {131026, 131047})
    void maps400WithClientErrorCodeToRejected(int metaCode) {
        server.expect(requestTo(MESSAGES_URL))
                .andRespond(withStatus(BAD_REQUEST)
                        .contentType(APPLICATION_JSON)
                        .body("""
                                {"error":{"message":"Failed for +998901234567","type":"OAuthException","code":%d}}
                                """.formatted(metaCode)));

        assertSendFails(Reason.REJECTED, 400, metaCode, false);
        server.verify();
    }

    @Test
    void maps401And400WithCode190ToUnauthorized() {
        server.expect(requestTo(MESSAGES_URL))
                .andRespond(withStatus(UNAUTHORIZED)
                        .contentType(APPLICATION_JSON)
                        .body("""
                                {"error":{"message":"Invalid OAuth access token test-token","code":190}}
                                """));

        assertSendFails(Reason.UNAUTHORIZED, 401, 190, false);
        server.verify();

        server.reset();
        server.expect(requestTo(MESSAGES_URL))
                .andRespond(withStatus(BAD_REQUEST)
                        .contentType(APPLICATION_JSON)
                        .body("""
                                {"error":{"message":"Token expired test-token","code":190}}
                                """));

        assertSendFails(Reason.UNAUTHORIZED, 400, 190, false);
        server.verify();
    }

    @Test
    void maps429WithoutBodyToRateLimited() {
        server.expect(requestTo(MESSAGES_URL))
                .andRespond(withStatus(TOO_MANY_REQUESTS));

        assertSendFails(Reason.RATE_LIMITED, 429, null, true);
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(ints = {4, 80007, 130429, 131056})
    void maps400WithMetaRateLimitCodeToRateLimited(int metaCode) {
        server.expect(requestTo(MESSAGES_URL))
                .andRespond(withStatus(BAD_REQUEST)
                        .contentType(APPLICATION_JSON)
                        .body("""
                                {"error":{"message":"Rate limit hit for 998901234567","code":%d}}
                                """.formatted(metaCode)));

        assertSendFails(Reason.RATE_LIMITED, 400, metaCode, true);
        server.verify();
    }

    @Test
    void maps503And500WithNonJsonBodyToUnavailable() {
        server.expect(requestTo(MESSAGES_URL))
                .andRespond(withStatus(SERVICE_UNAVAILABLE));

        assertSendFails(Reason.UNAVAILABLE, 503, null, true);
        server.verify();

        server.reset();
        server.expect(requestTo(MESSAGES_URL))
                .andRespond(withStatus(INTERNAL_SERVER_ERROR).body("oops"));

        assertSendFails(Reason.UNAVAILABLE, 500, null, true);
        server.verify();
    }

    @Test
    void mapsSocketTimeoutToUnavailableWithCause() {
        server.expect(requestTo(MESSAGES_URL))
                .andRespond(withException(new SocketTimeoutException("timeout")));

        assertThatThrownBy(() -> client.send(RECIPIENT_E164, new Text(SAMPLE_BODY)))
                .isInstanceOf(WhatsAppSendException.class)
                .satisfies(ex -> {
                    WhatsAppSendException sendEx = (WhatsAppSendException) ex;
                    assertThat(sendEx.reason()).isEqualTo(Reason.UNAVAILABLE);
                    assertThat(sendEx.httpStatus()).isZero();
                    assertThat(sendEx.errorCode()).isNull();
                    assertThat(sendEx.retryable()).isTrue();
                    assertThat(sendEx.getCause()).isNotNull();
                    assertNoSensitiveDataInMessage(sendEx);
                });
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "not json", "{\"messages\":[]}", "{\"messages\":[{\"id\":\"  \"}]}"})
    void maps200WithoutValidMessageIdToInvalidResponse(String invalidBody) {
        server.expect(requestTo(MESSAGES_URL))
                .andRespond(withSuccess(invalidBody, APPLICATION_JSON));

        assertSendFails(Reason.INVALID_RESPONSE, 200, null, false);
        server.verify();
    }

    @Test
    void notConfiguredThrowsBeforeMakingHttpRequest() {
        RestClient.Builder unconfiguredBuilder = RestClient.builder();
        MockRestServiceServer unconfiguredServer = MockRestServiceServer.bindTo(unconfiguredBuilder).build();
        WhatsAppClient unconfiguredClient = new WhatsAppClient(
                unconfiguredBuilder,
                props(BASE_URL, "", PHONE_NUMBER_ID),
                json);

        assertThatThrownBy(() -> unconfiguredClient.send(RECIPIENT_E164, new Text(SAMPLE_BODY)))
                .isInstanceOf(WhatsAppSendException.class)
                .satisfies(ex -> {
                    WhatsAppSendException sendEx = (WhatsAppSendException) ex;
                    assertThat(sendEx.reason()).isEqualTo(Reason.NOT_CONFIGURED);
                    assertThat(sendEx.httpStatus()).isZero();
                    assertThat(sendEx.errorCode()).isNull();
                    assertThat(sendEx.retryable()).isFalse();
                    assertNoSensitiveDataInMessage(sendEx);
                });
        unconfiguredServer.verify();
    }

    @Test
    void invalidRecipientThrowsIllegalArgumentExceptionBeforeHttpAndBeforeConfigCheck() {
        RestClient.Builder unconfiguredBuilder = RestClient.builder();
        MockRestServiceServer unconfiguredServer = MockRestServiceServer.bindTo(unconfiguredBuilder).build();
        WhatsAppClient unconfiguredClient = new WhatsAppClient(
                unconfiguredBuilder,
                props(BASE_URL, "", PHONE_NUMBER_ID),
                json);

        assertThatThrownBy(() -> unconfiguredClient.send("998901234567", new Text(SAMPLE_BODY)))
                .isInstanceOf(IllegalArgumentException.class)
                .satisfies(ex -> assertNoSensitiveDataInMessage(ex));
        unconfiguredServer.verify();

        assertThatThrownBy(() -> client.send("998901234567", new Text(SAMPLE_BODY)))
                .isInstanceOf(IllegalArgumentException.class)
                .satisfies(ex -> assertNoSensitiveDataInMessage(ex));
        server.verify();
    }

    @Test
    void configBeanBuildsAndRejectsSendWhenNotConfiguredWithoutNetwork() {
        WhatsAppApiProperties notConfiguredProps = new WhatsAppApiProperties(null, null, null, null, null);
        WhatsAppClient bean = new WhatsAppConfig().whatsAppClient(notConfiguredProps, json);

        assertThatThrownBy(() -> bean.send(RECIPIENT_E164, new Text(SAMPLE_BODY)))
                .isInstanceOf(WhatsAppSendException.class)
                .satisfies(ex -> {
                    WhatsAppSendException sendEx = (WhatsAppSendException) ex;
                    assertThat(sendEx.reason()).isEqualTo(Reason.NOT_CONFIGURED);
                    assertThat(sendEx.httpStatus()).isZero();
                    assertThat(sendEx.errorCode()).isNull();
                    assertThat(sendEx.retryable()).isFalse();
                    assertNoSensitiveDataInMessage(sendEx);
                });
    }

    private void assertSendFails(
            Reason expectedReason,
            int expectedStatus,
            @org.jspecify.annotations.Nullable Integer expectedCode,
            boolean expectedRetryable) {
        assertThatThrownBy(() -> client.send(RECIPIENT_E164, new Text(SAMPLE_BODY)))
                .isInstanceOf(WhatsAppSendException.class)
                .satisfies(ex -> {
                    WhatsAppSendException sendEx = (WhatsAppSendException) ex;
                    assertThat(sendEx.reason()).isEqualTo(expectedReason);
                    assertThat(sendEx.httpStatus()).isEqualTo(expectedStatus);
                    assertThat(sendEx.errorCode()).isEqualTo(expectedCode);
                    assertThat(sendEx.retryable()).isEqualTo(expectedRetryable);
                    String codeText = expectedCode != null ? expectedCode.toString() : "none";
                    assertThat(sendEx.getMessage()).isEqualTo(
                            "WhatsApp send failed: " + expectedReason
                                    + " (HTTP " + expectedStatus + ", code " + codeText + ")");
                    assertNoSensitiveDataInMessage(sendEx);
                });
    }

    private static void assertNoSensitiveDataInMessage(Throwable ex) {
        assertThat(ex.getMessage())
                .doesNotContain(ACCESS_TOKEN)
                .doesNotContain(RECIPIENT_DIGITS)
                .doesNotContain(SAMPLE_BODY);
    }

    private static WhatsAppApiProperties props(String url, String token, String phoneNumberId) {
        return new WhatsAppApiProperties(
                url,
                token,
                phoneNumberId,
                Duration.ofSeconds(5),
                Duration.ofSeconds(15));
    }
}
