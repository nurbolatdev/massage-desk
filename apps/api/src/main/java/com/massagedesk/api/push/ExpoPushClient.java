package com.massagedesk.api.push;

import com.massagedesk.api.push.PushSendException.Reason;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;
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
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Sends a batch of up to 100 push notifications in one POST to the Expo Push API
 * and returns the per-token tickets in request order. Does not retry failed batches
 * and does not poll push receipts; the ticket {@code message} field is ignored because
 * Expo includes the device token in it.
 */
class ExpoPushClient {

    private static final int MAX_BATCH_SIZE = 100;
    private static final int MAX_ERROR_BODY_BYTES = 64 * 1024;
    private static final Pattern REQUEST_ERROR_CODE_PATTERN = Pattern.compile("^[A-Z0-9_]{1,64}$");
    private static final Pattern TICKET_ERROR_CODE_PATTERN = Pattern.compile("^[A-Za-z0-9_]{1,64}$");

    private final RestClient restClient;
    private final PushProperties api;
    private final JsonMapper json;

    ExpoPushClient(RestClient.Builder builder, PushProperties api, JsonMapper json) {
        Objects.requireNonNull(builder, "builder");
        this.api = Objects.requireNonNull(api, "api");
        this.json = Objects.requireNonNull(json, "json");
        if (!api.accessToken().isEmpty()) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + api.accessToken());
        }
        this.restClient = builder.build();
    }

    boolean configured() {
        return api.configured();
    }

    List<PushTicket> send(List<String> tokens, PushMessage message) {
        Objects.requireNonNull(tokens, "tokens");
        Objects.requireNonNull(message, "message");
        if (tokens.isEmpty() || tokens.size() > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("push batch must have 1..100 tokens");
        }
        if (!api.configured()) {
            throw new PushSendException(Reason.NOT_CONFIGURED, 0, null);
        }
        String payload = buildPayload(tokens, message);
        ResponseEntity<String> response;
        try {
            response = restClient.post()
                    .uri(URI.create(api.url()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        throw classifyError(res);
                    })
                    .toEntity(String.class);
        } catch (ResourceAccessException e) {
            throw new PushSendException(Reason.UNAVAILABLE, 0, null, e);
        } catch (RestClientException e) {
            throw new PushSendException(Reason.INVALID_RESPONSE, 0, null, e);
        }
        return parseTickets(response.getBody(), response.getStatusCode().value(), tokens.size());
    }

    private String buildPayload(List<String> tokens, PushMessage message) {
        ArrayNode array = json.createArrayNode();
        for (String token : tokens) {
            ObjectNode item = array.addObject();
            item.put("to", token);
            item.put("title", message.title());
            item.put("body", message.body());
            if (!message.data().isEmpty()) {
                ObjectNode dataNode = item.putObject("data");
                message.data().forEach(dataNode::put);
            }
            if (message.channelId() != null) {
                item.put("channelId", message.channelId());
            }
            item.put("sound", "default");
            item.put("priority", "high");
        }
        return json.writeValueAsString(array);
    }

    private PushSendException classifyError(ClientHttpResponse response) throws IOException {
        int status = response.getStatusCode().value();
        String errorCode = readErrorCode(response);
        Reason reason = classifyReason(status);
        return new PushSendException(reason, status, errorCode);
    }

    private static Reason classifyReason(int status) {
        if (status == 401 || status == 403) {
            return Reason.UNAUTHORIZED;
        }
        if (status == 429) {
            return Reason.RATE_LIMITED;
        }
        if (status >= 500 && status < 600) {
            return Reason.UNAVAILABLE;
        }
        return Reason.REJECTED;
    }

    private @Nullable String readErrorCode(ClientHttpResponse response) {
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
        JsonNode errors = root.path("errors");
        if (!errors.isArray() || errors.isEmpty()) {
            return null;
        }
        JsonNode codeNode = errors.path(0).path("code");
        if (!codeNode.isString()) {
            return null;
        }
        String code = codeNode.asString();
        return REQUEST_ERROR_CODE_PATTERN.matcher(code).matches() ? code : null;
    }

    private List<PushTicket> parseTickets(
            @Nullable String responseBody,
            int httpStatus,
            int expectedCount) {
        if (responseBody == null || responseBody.isBlank()) {
            throw new PushSendException(Reason.INVALID_RESPONSE, httpStatus, null);
        }
        JsonNode root;
        try {
            root = json.readTree(responseBody);
        } catch (JacksonException e) {
            throw new PushSendException(Reason.INVALID_RESPONSE, httpStatus, null);
        }
        if (root == null || !root.isObject()) {
            throw new PushSendException(Reason.INVALID_RESPONSE, httpStatus, null);
        }
        JsonNode data = root.path("data");
        if (!data.isArray() || data.size() != expectedCount) {
            throw new PushSendException(Reason.INVALID_RESPONSE, httpStatus, null);
        }
        List<PushTicket> tickets = new ArrayList<>(expectedCount);
        for (JsonNode item : data) {
            if (item == null || !item.isObject()) {
                throw new PushSendException(Reason.INVALID_RESPONSE, httpStatus, null);
            }
            tickets.add(toTicket(item));
        }
        return List.copyOf(tickets);
    }

    private static PushTicket toTicket(JsonNode item) {
        JsonNode statusNode = item.path("status");
        String status = statusNode.isString() ? statusNode.asString() : "";
        if ("ok".equals(status)) {
            return new PushTicket(true, null);
        }
        if ("error".equals(status)) {
            JsonNode errorNode = item.path("details").path("error");
            String error = errorNode.isString() ? errorNode.asString() : null;
            if (error != null && TICKET_ERROR_CODE_PATTERN.matcher(error).matches()) {
                return new PushTicket(false, error);
            }
            return new PushTicket(false, null);
        }
        return new PushTicket(false, null);
    }
}
