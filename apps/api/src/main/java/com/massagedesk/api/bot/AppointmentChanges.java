package com.massagedesk.api.bot;

import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.BookingException;
import com.massagedesk.api.bot.BotReplies.Upcoming;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.ClientMessageReceived;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Changes only the client's own upcoming confirmed appointments, re-checked on every step; a
 * confirmation step is claimed before the change, so a repeated tap never changes twice.
 */
@Component
class AppointmentChanges {

    private final AppointmentService appointments;
    private final BotSessionStore sessions;
    private final BotLists lists;
    private final Clock clock;

    AppointmentChanges(
            AppointmentService appointments, BotSessionStore sessions, BotLists lists, Clock clock) {
        this.appointments = Objects.requireNonNull(appointments, "appointments");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.lists = Objects.requireNonNull(lists, "lists");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    List<Upcoming> upcoming(UUID clientId) {
        return appointments.upcomingOfClient(clientId, BotReplies.MAX_UPCOMING).stream()
                .map(v -> new Upcoming(
                        v.appointment().id(),
                        v.appointment().serviceId(),
                        v.serviceName(),
                        v.appointment().period().start()))
                .toList();
    }

    Optional<Upcoming> own(UUID appointmentId, UUID clientId) {
        return upcoming(clientId).stream()
                .filter(item -> item.id().equals(appointmentId))
                .findFirst();
    }

    Turn menu(UUID clientId) {
        return new Turn(
                BotSession.menu(),
                List.of(BotReplies.menu(upcoming(clientId), lists.zone())));
    }

    Turn gone(UUID clientId) {
        return new Turn(
                BotSession.menu(),
                List.of(new Text(BotReplies.GONE_TEXT), BotReplies.menu(upcoming(clientId), lists.zone())));
    }

    Turn picks(UUID clientId, Step step, String body) {
        List<Upcoming> items = upcoming(clientId);
        if (items.isEmpty()) {
            return new Turn(BotSession.menu(), List.of(BotReplies.noUpcoming()));
        }
        return new Turn(
                new BotSession(step, null, null, null, null),
                List.of(BotReplies.picks(body, items, lists.zone())));
    }

    Turn pickList(UUID clientId) {
        return picks(clientId, Step.CANCEL_PICK, BotReplies.CANCEL_PICK_TEXT);
    }

    Turn onPick(UUID clientId, @Nullable String replyId) {
        if (BotReplies.BOOK.equals(replyId)) {
            return lists.serviceList(0);
        }
        Optional<Upcoming> picked =
                BotReplies.appointmentIdOf(replyId).flatMap(id -> own(id, clientId));
        if (picked.isPresent()) {
            Upcoming item = picked.get();
            return new Turn(
                    new BotSession(Step.CANCEL_CONFIRM, null, null, null, item.id()),
                    List.of(BotReplies.cancelConfirmation(item, lists.zone())));
        }
        return pickList(clientId);
    }

    Optional<Turn> onCancelConfirm(
            BotSession current, @Nullable Instant updatedAt, ClientMessageReceived message) {
        if (BotReplies.BOOK.equals(message.replyId())) {
            return Optional.of(lists.serviceList(0));
        }
        UUID appointmentId = current.appointmentId();
        UUID clientId = message.clientId();
        if (appointmentId == null || updatedAt == null) {
            return Optional.of(menu(clientId));
        }
        if (BotReplies.KEEP.equals(message.replyId())) {
            return Optional.of(menu(clientId));
        }
        if (BotReplies.cancelConfirmOf(message.replyId()).filter(appointmentId::equals).isEmpty()) {
            return Optional.of(own(appointmentId, clientId)
                    .map(item -> new Turn(current, List.of(BotReplies.cancelConfirmation(item, lists.zone()))))
                    .orElseGet(() -> gone(clientId)));
        }
        if (!sessions.claim(
                message.conversationId(), Step.CANCEL_CONFIRM, updatedAt, clock.instant())) {
            return Optional.empty();
        }
        Optional<Upcoming> target = own(appointmentId, clientId);
        if (target.isEmpty()) {
            return Optional.of(gone(clientId));
        }
        try {
            appointments.cancel(appointmentId, EventActor.BOT);
        } catch (BookingException e) {
            return Optional.of(switch (e.reason()) {
                case APPOINTMENT_NOT_FOUND, NOT_CONFIRMED -> gone(clientId);
                case CLIENT_NOT_FOUND, SERVICE_NOT_FOUND, OUTSIDE_SCHEDULE, TIME_TAKEN,
                        NOT_STARTED, IDEMPOTENCY_KEY_REUSED -> menu(clientId);
            });
        }
        return Optional.of(new Turn(
                BotSession.menu(), List.of(BotReplies.cancelled(target.get(), lists.zone()))));
    }
}
