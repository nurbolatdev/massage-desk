package com.massagedesk.api.messaging;

import static com.massagedesk.api.messaging.OutboundRows.conversation;
import static com.massagedesk.api.messaging.OutboundRows.conversationRow;
import static com.massagedesk.api.messaging.OutboundRows.count;
import static com.massagedesk.api.messaging.OutboundRows.messagesOf;
import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;
import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.ClientService;
import com.massagedesk.api.messaging.ConversationStore.Recipient;
import com.massagedesk.api.messaging.OutboundRows.ConversationRow;
import com.massagedesk.api.messaging.OutboundRows.MessageRow;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class ConversationStoreOutboundTests {

    @Autowired
    private ConversationStore store;

    @Autowired
    private ClientService clients;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void recipientOfReturnsClientPhoneAndLastInboundTimeOrEmptyWhenMissing() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID openId = conversation(clients, store, jdbc, "+998900001101", inboundAt);
        UUID neverInboundId = conversation(clients, store, jdbc, "+998900001102", null);

        assertThat(store.recipientOf(openId))
                .contains(new Recipient("+998900001101", inboundAt));
        assertThat(store.recipientOf(neverInboundId))
                .contains(new Recipient("+998900001102", null));
        assertThat(store.recipientOf(UUID.randomUUID())).isEmpty();
    }

    @Test
    void addOutboundStoresRowMovesLastMessageAtAndKeepsLastInboundAt() {
        Instant inboundAt = NOW.minus(Duration.ofHours(1));
        UUID openId = conversation(clients, store, jdbc, "+998900001103", inboundAt);
        UUID nullInboundId = conversation(clients, store, jdbc, "+998900001104", null);

        Optional<UUID> firstId = store.addOutbound(openId, "bot", "Здравствуйте", "wamid.out-1", NOW);
        Optional<UUID> secondId = store.addOutbound(nullInboundId, "bot", "Напоминание", "wamid.out-2", NOW);

        assertThat(firstId).isPresent();
        assertThat(messagesOf(jdbc, openId)).containsExactly(new MessageRow(
                firstId.get(), openId, "out", "bot", "Здравствуйте", "wamid.out-1", NOW));
        ConversationRow openRow = conversationRow(jdbc, openId);
        assertThat(openRow.lastMessageAt()).isEqualTo(NOW);
        assertThat(openRow.lastInboundAt()).isEqualTo(inboundAt);

        assertThat(secondId).isPresent();
        assertThat(messagesOf(jdbc, nullInboundId)).containsExactly(new MessageRow(
                secondId.get(), nullInboundId, "out", "bot", "Напоминание", "wamid.out-2", NOW));
        ConversationRow nullInboundRow = conversationRow(jdbc, nullInboundId);
        assertThat(nullInboundRow.lastMessageAt()).isEqualTo(NOW);
        assertThat(nullInboundRow.lastInboundAt()).isNull();
    }

    @Test
    void addOutboundStoresMasterAuthorAndNullBody() {
        UUID id = conversation(clients, store, jdbc, "+998900001105", null);

        Optional<UUID> messageId = store.addOutbound(id, "master", null, "wamid.out-3", NOW);

        assertThat(messageId).isPresent();
        assertThat(messagesOf(jdbc, id)).containsExactly(new MessageRow(
                messageId.get(), id, "out", "master", null, "wamid.out-3", NOW));
    }

    @Test
    void addOutboundWithEarlierTimeDoesNotMoveLastMessageAtBackwards() {
        UUID id = conversation(clients, store, jdbc, "+998900001106", NOW);
        Instant earlier = NOW.minus(Duration.ofMinutes(30));

        Optional<UUID> messageId = store.addOutbound(id, "bot", "Раннее", "wamid.out-4", earlier);

        assertThat(messageId).isPresent();
        ConversationRow row = conversationRow(jdbc, id);
        assertThat(row.lastMessageAt()).isEqualTo(NOW);
        assertThat(row.lastInboundAt()).isEqualTo(NOW);
    }

    @Test
    void duplicateWaMessageIdWithLaterTimestampReturnsEmptyAndDoesNotMoveLastMessageAt() {
        UUID id = conversation(clients, store, jdbc, "+998900001107", NOW.minus(Duration.ofHours(1)));
        Instant later = NOW.plus(Duration.ofMinutes(10));

        Optional<UUID> first = store.addOutbound(id, "bot", "Первое", "wamid.out-dup", NOW);
        long messagesAfterFirst = count(jdbc, "messages");
        Optional<UUID> duplicate = store.addOutbound(id, "bot", "Повтор", "wamid.out-dup", later);

        assertThat(first).isPresent();
        assertThat(duplicate).isEmpty();
        assertThat(count(jdbc, "messages")).isEqualTo(messagesAfterFirst);
        assertThat(messagesOf(jdbc, id)).containsExactly(new MessageRow(
                first.get(), id, "out", "bot", "Первое", "wamid.out-dup", NOW));
        assertThat(conversationRow(jdbc, id).lastMessageAt()).isEqualTo(NOW);
        assertThat(store.messageIdOf(id, "wamid.out-dup")).contains(first.get());
    }

    @Test
    void messageIdOfFindsOnlyOutboundMessageInSameConversation() {
        UUID firstConv = conversation(clients, store, jdbc, "+998900001108", NOW);
        UUID otherConv = conversation(clients, store, jdbc, "+998900001109", NOW);
        Optional<UUID> outboundId = store.addOutbound(firstConv, "bot", "Исходящее", "wamid.out-scope", NOW);
        store.addInbound(firstConv, "wamid.in-scope", "Входящее", NOW);

        assertThat(store.messageIdOf(firstConv, "wamid.out-scope")).isEqualTo(outboundId);
        assertThat(store.messageIdOf(otherConv, "wamid.out-scope")).isEmpty();
        assertThat(store.messageIdOf(firstConv, "wamid.in-scope")).isEmpty();
    }

    @Test
    void recipientToStringHidesPhone() {
        Recipient recipient = new Recipient("+998900001101", null);

        assertThat(recipient.toString())
                .doesNotContain("998900001101")
                .contains("<hidden>");
    }
}
