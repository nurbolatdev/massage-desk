package com.massagedesk.api.messaging;

import com.massagedesk.api.clients.ClientService;
import com.massagedesk.api.clients.PhoneNumbers;
import com.massagedesk.api.clients.PhoneProperties;
import com.massagedesk.api.events.EventActor;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Stores client messages of one delivery in one transaction;
 * creates the client and the conversation on the first message;
 * moves the 24-hour window.
 */
@Service
class InboundMessages {

    private static final Pattern WA_ID_DIGITS = Pattern.compile("^[0-9]{1,15}$");

    private final ClientService clients;
    private final ConversationStore conversations;
    private final PhoneProperties phone;
    private final Clock clock;

    InboundMessages(
            ClientService clients,
            ConversationStore conversations,
            PhoneProperties phone,
            Clock clock) {
        this.clients = clients;
        this.conversations = conversations;
        this.phone = phone;
        this.clock = clock;
    }

    record Stored(int added, int duplicates) {

        boolean isDuplicate() {
            return added == 0 && duplicates > 0;
        }
    }

    @Transactional
    Stored store(List<WebhookPayload.InboundMessage> messages) {
        int added = 0;
        int duplicates = 0;
        for (WebhookPayload.InboundMessage m : messages) {
            Optional<String> normalized = phoneOf(m.waId(), phone.defaultRegion());
            if (normalized.isEmpty()) {
                continue;
            }
            UUID clientId = clients.findOrCreate(normalized.get(), m.profileName(), EventActor.CLIENT);
            UUID conversationId = conversations.conversationOf(clientId);
            Instant now = clock.instant();
            Instant at = m.sentAt() != null && m.sentAt().isBefore(now) ? m.sentAt() : now;
            if (conversations.addInbound(conversationId, m.waMessageId(), m.text(), at)) {
                conversations.touchInbound(conversationId, at);
                added++;
            } else {
                duplicates++;
            }
        }
        return new Stored(added, duplicates);
    }

    static Optional<String> phoneOf(String waId, String defaultRegion) {
        if (waId == null || !WA_ID_DIGITS.matcher(waId).matches()) {
            return Optional.empty();
        }
        String candidate = "+" + waId;
        Optional<String> normalized = PhoneNumbers.normalize(candidate, defaultRegion);
        if (normalized.isPresent()) {
            return normalized;
        }
        return PhoneNumbers.isE164(candidate) ? Optional.of(candidate) : Optional.empty();
    }
}
