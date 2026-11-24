package com.massagedesk.api.bot;

import com.massagedesk.api.bot.BotSessionStore.Loaded;
import com.massagedesk.api.messaging.ClientMessageReceived;
import com.massagedesk.api.messaging.OutboundMessage;
import com.massagedesk.api.messaging.OutboundMessages;
import com.massagedesk.api.messaging.OutboundMessages.Author;
import com.massagedesk.api.settings.SettingsService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Button booking conversation; silent when the bot is off or the master took over.
 * State is saved before replies, and replies are sent outside any transaction.
 */
@Service
class BookingBot {

    static final Duration SESSION_LIFETIME = Duration.ofHours(24);

    record Turn(BotSession next, List<OutboundMessage> replies) {
        Turn {
            Objects.requireNonNull(next, "next");
            replies = List.copyOf(Objects.requireNonNull(replies, "replies"));
        }
    }

    private final SettingsService settings;
    private final BotSessionStore sessions;
    private final OutboundMessages outbound;
    private final Clock clock;

    BookingBot(SettingsService settings, BotSessionStore sessions, OutboundMessages outbound, Clock clock) {
        this.settings = Objects.requireNonNull(settings, "settings");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.outbound = Objects.requireNonNull(outbound, "outbound");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @EventListener
    public void on(ClientMessageReceived message) {
        Objects.requireNonNull(message, "message");
        if (!settings.current().isBotEnabled()) {
            return;
        }
        Optional<Loaded> loaded = sessions.load(message.conversationId());
        if (loaded.isEmpty() || loaded.get().humanMode()) {
            return;
        }
        Instant now = clock.instant();
        BotSession current = currentSession(loaded.get(), now);
        Turn turn = next(current, message);
        sessions.save(message.conversationId(), turn.next(), now);
        for (OutboundMessage reply : turn.replies()) {
            outbound.send(message.conversationId(), Author.BOT, reply);
        }
    }

    private static BotSession currentSession(Loaded loaded, Instant now) {
        BotSession session = loaded.session();
        Instant updatedAt = loaded.updatedAt();
        if (session != null && updatedAt != null && updatedAt.plus(SESSION_LIFETIME).isAfter(now)) {
            return session;
        }
        return BotSession.menu();
    }

    private Turn next(BotSession current, ClientMessageReceived message) {
        return switch (current.step()) {
            case MENU, SERVICE, DAY, TIME, CONFIRM, MOVE_PICK, CANCEL_PICK, CANCEL_CONFIRM ->
                    new Turn(BotSession.menu(), List.of(BotReplies.menu()));
        };
    }
}
