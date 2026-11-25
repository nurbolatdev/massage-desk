package com.massagedesk.api.bot;

import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;

import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.messaging.ClientMessageReceived;
import com.massagedesk.api.messaging.OutboundMessages;
import com.massagedesk.api.schedule.SlotService;
import com.massagedesk.api.settings.SettingsService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.ApplicationContext;
import org.springframework.http.client.ClientHttpRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.http.client.MockClientHttpRequest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class BotConversations {

    private static final String BOT_PHONE_PATTERN = "+99890000120_";

    record SessionRow(String step, Instant updatedAt) {
    }

    record StoredMessage(String direction, String author, String body) {
    }

    private BotConversations() {
    }

    static BookingBot bot(ApplicationContext context, OutboundMessages outbound) {
        return new BookingBot(
                context.getBean(SettingsService.class),
                context.getBean(BotSessionStore.class),
                context.getBean(BotLists.class),
                context.getBean(AppointmentChanges.class),
                context.getBean(Rescheduling.class),
                context.getBean(SlotService.class),
                context.getBean(AppointmentService.class),
                outbound,
                context.getBean(Clock.class));
    }

    static UUID conversation(ClientRepository clients, JdbcTemplate jdbc, String phone) {
        return conversation(clients, jdbc, phone, false);
    }

    static UUID conversation(ClientRepository clients, JdbcTemplate jdbc, String phone, boolean humanMode) {
        Client client = clients.saveAndFlush(new Client(phone, "Bot client"));
        OffsetDateTime inboundAt = NOW.minus(Duration.ofMinutes(1)).atOffset(ZoneOffset.UTC);
        return jdbc.queryForObject(
                """
                insert into conversations (id, client_id, human_mode, last_inbound_at, last_message_at)
                values (?, ?, ?, cast(? as timestamptz), cast(? as timestamptz)) returning id""",
                UUID.class, UUID.randomUUID(), client.getId(), humanMode, inboundAt, inboundAt);
    }

    static UUID clientIdOf(JdbcTemplate jdbc, UUID conversationId) {
        return jdbc.queryForObject(
                "select client_id from conversations where id = ?", UUID.class, conversationId);
    }

    static Optional<SessionRow> sessionOf(JdbcTemplate jdbc, UUID conversationId) {
        return jdbc.query(
                        "select step, updated_at from bot_sessions where conversation_id = ?",
                        (rs, rowNum) -> new SessionRow(
                                rs.getString("step"),
                                rs.getObject("updated_at", OffsetDateTime.class).toInstant()),
                        conversationId)
                .stream()
                .findFirst();
    }

    static List<StoredMessage> messagesOf(JdbcTemplate jdbc, UUID conversationId) {
        return jdbc.query(
                "select direction, author, body from messages where conversation_id = ? order by created_at, id",
                (rs, rowNum) -> new StoredMessage(
                        rs.getString("direction"), rs.getString("author"), rs.getString("body")),
                conversationId);
    }

    static void cleanUp(JdbcTemplate jdbc) {
        jdbc.update("""
                delete from events where entity_id in (
                    select id from appointments where client_id in (select id from clients where phone like ?)
                )""", BOT_PHONE_PATTERN);
        jdbc.update("""
                delete from appointments where client_id in (select id from clients where phone like ?)""",
                BOT_PHONE_PATTERN);
        jdbc.update("""
                delete from messages where conversation_id in (
                    select id from conversations where client_id in (select id from clients where phone like ?)
                )""", BOT_PHONE_PATTERN);
        jdbc.update("""
                delete from conversations where client_id in (select id from clients where phone like ?)""",
                BOT_PHONE_PATTERN);
        jdbc.update("delete from clients where phone like ?", BOT_PHONE_PATTERN);
        jdbc.update("update settings set bot_enabled = true");
    }

    static JsonNode requestJson(JsonMapper json, ClientHttpRequest request) {
        return json.readTree(((MockClientHttpRequest) request).getBodyAsString());
    }

    static List<String> buttonIds(JsonNode body) {
        List<String> ids = new ArrayList<>();
        for (JsonNode button : body.path("interactive").path("action").path("buttons")) {
            ids.add(button.path("reply").path("id").asString());
        }
        return ids;
    }

    static List<String> rowIds(JsonNode body) {
        List<String> ids = new ArrayList<>();
        for (JsonNode row : body.path("interactive").path("action").path("sections").path(0).path("rows")) {
            ids.add(row.path("id").asString());
        }
        return ids;
    }

    static ClientMessageReceived text(JdbcTemplate jdbc, UUID conversationId, String body) {
        return new ClientMessageReceived(
                conversationId, clientIdOf(jdbc, conversationId), "wamid.bot-text", body, null);
    }

    static ClientMessageReceived reply(JdbcTemplate jdbc, UUID conversationId, String replyId) {
        return new ClientMessageReceived(
                conversationId, clientIdOf(jdbc, conversationId), "wamid.bot-reply", replyId, replyId);
    }
}
