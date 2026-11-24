package com.massagedesk.api.messaging;

import java.time.Clock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

public final class TestOutboundMessages {

    public static final String API_URL = "https://graph.test/v99.0";
    public static final String MESSAGES_URL = API_URL + "/123456/messages";

    private TestOutboundMessages() {
    }

    public static OutboundMessages create(
            JdbcClient jdbc,
            RestClient.Builder builder,
            JsonMapper json,
            Clock clock) {
        return new OutboundMessages(
                new ConversationStore(jdbc),
                new WhatsAppClient(
                        builder,
                        new WhatsAppApiProperties(API_URL, "test-token", "123456", null, null),
                        json),
                clock);
    }

    public static String accepted(String waMessageId) {
        return "{\"messaging_product\":\"whatsapp\",\"messages\":[{\"id\":\"" + waMessageId + "\"}]}";
    }
}
