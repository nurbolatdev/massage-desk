package com.massagedesk.api.bot;

import com.massagedesk.api.bot.BotReplies.Upcoming;
import com.massagedesk.api.bot.BotSession.Step;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Moves only the client's own upcoming confirmed appointments, re-checked on every step; free time
 * comes from the schedule service with the moving appointment excluded.
 */
@Component
class Rescheduling {

    private final AppointmentChanges changes;
    private final BotLists lists;

    Rescheduling(AppointmentChanges changes, BotLists lists) {
        this.changes = Objects.requireNonNull(changes, "changes");
        this.lists = Objects.requireNonNull(lists, "lists");
    }

    Turn pickList(UUID clientId) {
        return changes.picks(clientId, Step.MOVE_PICK, BotReplies.MOVE_PICK_TEXT);
    }

    Turn onPick(UUID clientId, @Nullable String replyId) {
        if (BotReplies.BOOK.equals(replyId)) {
            return lists.serviceList(0);
        }
        Optional<Upcoming> picked =
                BotReplies.appointmentIdOf(replyId).flatMap(id -> changes.own(id, clientId));
        if (picked.isPresent()) {
            return lists.moveDayList(picked.get(), null).orElseGet(() -> changes.gone(clientId));
        }
        return pickList(clientId);
    }
}
