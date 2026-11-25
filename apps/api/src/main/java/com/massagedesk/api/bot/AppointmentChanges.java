package com.massagedesk.api.bot;

import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.bot.BotReplies.Upcoming;
import com.massagedesk.api.bot.BotSession.Step;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Lists the client's upcoming confirmed appointments for the menu and cancellation flow.
 */
@Component
class AppointmentChanges {

    private final AppointmentService appointments;
    private final BotLists lists;

    AppointmentChanges(AppointmentService appointments, BotLists lists) {
        this.appointments = Objects.requireNonNull(appointments, "appointments");
        this.lists = Objects.requireNonNull(lists, "lists");
    }

    List<Upcoming> upcoming(UUID clientId) {
        return appointments.upcomingOfClient(clientId, BotReplies.MAX_UPCOMING).stream()
                .map(v -> new Upcoming(
                        v.appointment().id(), v.serviceName(), v.appointment().period().start()))
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

    Turn pickList(UUID clientId) {
        List<Upcoming> items = upcoming(clientId);
        if (items.isEmpty()) {
            return new Turn(BotSession.menu(), List.of(BotReplies.noUpcoming()));
        }
        return new Turn(
                new BotSession(Step.CANCEL_PICK, null, null, null, null),
                List.of(BotReplies.picks(BotReplies.CANCEL_PICK_TEXT, items, lists.zone())));
    }

    Turn onPick(UUID clientId, @Nullable String replyId) {
        Optional<Upcoming> picked =
                BotReplies.appointmentIdOf(replyId).flatMap(id -> own(id, clientId));
        if (picked.isPresent()) {
            return menu(clientId);
        }
        return pickList(clientId);
    }
}
