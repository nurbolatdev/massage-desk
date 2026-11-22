package com.massagedesk.api.messaging;

import com.massagedesk.api.messaging.WhatsAppSendException.Reason;
import java.io.IOException;
import java.io.InputStream;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Sends one message through the WhatsApp Cloud API, returns its WhatsApp message id,
 * and never retries. Does not check the 24-hour customer service window (the caller does).
 */
class WhatsAppClient {

    private static final int MAX_ERROR_BODY_BYTES = 64 * 1024;
    private static final int META_AUTH_ERROR_CODE = 190;
    private static final Set<Integer> META_RATE_LIMIT_CODES = Set.of(4, 80007, 130429, 131056);

    private final RestClient restClient;
    private final WhatsAppApiProperties api;
    private final JsonMapper json;

    WhatsAppClient(RestClient.Builder builder, WhatsAppApiProperties api, JsonMapper json) {
        Objects.requireNonNull(builder, "builder");
        this.api = Objects.requireNonNull(api, "api");
        this.json = Objects.requireNonNull(json, "json");
        if (api.configured()) {
            builder.baseUrl(api.url())
                    .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + api.accessToken());
        }
        this.restClient = builder.build();
    }

    String send(String recipientE164, OutboundMessage message) {
        ObjectNode requestBody = WhatsAppRequests.body(recipientE164, message, json);
        if (!api.configured()) {
            throw new WhatsAppSendException(Reason.NOT_CONFIGURED, 0, null);
        }
        String payload = json.writeValueAsString(requestBody);
        ResponseEntity<String> response;
        try {
            response = restClient.post()
                    .uri("/{id}/messages", api.phoneNumberId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        throw classifyError(res);
                    })
                    .toEntity(String.class);
        } catch (ResourceAccessException e) {
            throw new WhatsAppSendException(Reason.UNAVAILABLE, 0, null, e);
        } catch (RestClientException e) {
            throw new WhatsAppSendException(Reason.INVALID_RESPONSE, 0, null, e);
        }
        return extractMessageId(response.getBody(), response.getStatusCode().value());
    }

    private WhatsAppSendException classifyError(ClientHttpResponse response) throws IOException {
        int status = response.getStatusCode().value();
        Integer errorCode = readErrorCode(response);
        Reason reason = classifyReason(status, errorCode);
        return new WhatsAppSendException(reason, status, errorCode);
    }

    private static Reason classifyReason(int status, @Nullable Integer errorCode) {
        if (status == 401 || (errorCode != null && errorCode == META_AUTH_ERROR_CODE)) {
            return Reason.UNAUTHORIZED;
        }
        if (status == 429 || (errorCode != null && META_RATE_LIMIT_CODES.contains(errorCode))) {
            return Reason.RATE_LIMITED;
        }
        if (status >= 500 && status < 600) {
            return Reason.UNAVAILABLE;
        }
        return Reason.REJECTED;
    }

    private @Nullable Integer readErrorCode(ClientHttpResponse response) {
        byte[] bytes;
        try (InputStream body = response.getBody()) {
            if (body == null) {
                return null;
            }
            bytes = body.readNBytes(MAX_ERROR_BODY_BYTES);
        } catch (IOException e) {
            return null;
        }
        if (bytes.length == 0) {
            return null;
        }
        JsonNode root;
        try {
            root = json.readTree(bytes);
        } catch (JacksonException e) {
            return null;
        }
        if (root == null || !root.isObject()) {
            return null;
        }
        JsonNode code = root.path("error").path("code");
        return code.isIntegralNumber() && code.canConvertToInt() ? code.asInt() : null;
    }

    private String extractMessageId(@Nullable String responseBody, int httpStatus) {
        if (responseBody == null || responseBody.isBlank()) {
            throw new WhatsAppSendException(Reason.INVALID_RESPONSE, httpStatus, null);
        }
        JsonNode root;
        try {
            root = json.readTree(responseBody);
        } catch (JacksonException e) {
            throw new WhatsAppSendException(Reason.INVALID_RESPONSE, httpStatus, null);
        }
        if (root == null || !root.isObject()) {
            throw new WhatsAppSendException(Reason.INVALID_RESPONSE, httpStatus, null);
        }
        JsonNode idNode = root.path("messages").path(0).path("id");
        String id = idNode.isString() ? idNode.asString().trim() : "";
        if (id.isEmpty()) {
            throw new WhatsAppSendException(Reason.INVALID_RESPONSE, httpStatus, null);
        }
        return id;
    }
}
