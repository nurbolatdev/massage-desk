package com.massagedesk.api.bot;

import com.massagedesk.api.bot.BotReplies.Upcoming;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.messaging.ClientMessageReceived;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
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

    Turn onDay(BotSession current, ClientMessageReceived message) {
        if (BotReplies.BOOK.equals(message.replyId())) {
            return lists.serviceList(0);
        }
        UUID clientId = message.clientId();
        Optional<Upcoming> own =
                Optional.ofNullable(current.appointmentId()).flatMap(id -> changes.own(id, clientId));
        if (own.isEmpty()) {
            return changes.gone(clientId);
        }
        Upcoming item = own.get();
        Optional<LocalDate> day = lists.pickedDay(message.replyId());
        Optional<Turn> turn = day.isPresent()
                ? lists.moveTimeList(item, day.get(), null, null)
                : lists.moveDayList(item, null);
        return turn.orElseGet(() -> changes.gone(clientId));
    }

    Turn onTime(BotSession current, ClientMessageReceived message) {
        String replyId = message.replyId();
        if (BotReplies.BOOK.equals(replyId)) {
            return lists.serviceList(0);
        }
        UUID clientId = message.clientId();
        LocalDate day = current.day();
        UUID appointmentId = current.appointmentId();
        if (day == null || appointmentId == null) {
            return changes.menu(clientId);
        }
        Optional<Upcoming> own = changes.own(appointmentId, clientId);
        if (own.isEmpty()) {
            return changes.gone(clientId);
        }
        Upcoming item = own.get();
        Optional<Instant> start = BotReplies.timeOf(replyId);
        if (start.isPresent()) {
            Instant pickedStart = start.get();
            ZoneId zone = lists.zone();
            if (!LocalDate.ofInstant(pickedStart, zone).equals(day)) {
                return lists.moveTimeList(item, day, null, null)
                        .orElseGet(() -> changes.gone(clientId));
            }
            Optional<List<Instant>> starts = lists.moveStarts(item, day);
            if (starts.isEmpty()) {
                return changes.gone(clientId);
            }
            if (starts.get().contains(pickedStart)) {
                return new Turn(
                        new BotSession(Step.CONFIRM, null, day, pickedStart, item.id()),
                        List.of(BotReplies.moveConfirmation(item, pickedStart, zone)));
            }
            return lists.moveTimeList(item, day, null, new Text(BotReplies.TIME_TAKEN_TEXT))
                    .orElseGet(() -> changes.gone(clientId));
        }
        Optional<Instant> after = BotReplies.moreTimesAfterOf(replyId);
        if (after.isPresent()) {
            return lists.moveTimeList(item, day, after.get(), null)
                    .orElseGet(() -> changes.gone(clientId));
        }
        if (BotReplies.OTHER_DAY.equals(replyId)) {
            return lists.moveDayList(item, null).orElseGet(() -> changes.gone(clientId));
        }
        return lists.moveTimeList(item, day, null, null).orElseGet(() -> changes.gone(clientId));
    }
}
