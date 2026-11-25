package com.massagedesk.api.bot;

import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.AppointmentService.AppointmentView;
import com.massagedesk.api.booking.BookingException;
import com.massagedesk.api.bot.BotReplies.IdAndStart;
import com.massagedesk.api.bot.BotReplies.Upcoming;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.ClientMessageReceived;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import java.time.Clock;
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
    private final AppointmentService appointments;
    private final BotSessionStore sessions;
    private final Clock clock;

    Rescheduling(
            AppointmentChanges changes,
            BotLists lists,
            AppointmentService appointments,
            BotSessionStore sessions,
            Clock clock) {
        this.changes = Objects.requireNonNull(changes, "changes");
        this.lists = Objects.requireNonNull(lists, "lists");
        this.appointments = Objects.requireNonNull(appointments, "appointments");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.clock = Objects.requireNonNull(clock, "clock");
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

    Optional<Turn> onConfirm(
            BotSession current, @Nullable Instant updatedAt, ClientMessageReceived message) {
        String replyId = message.replyId();
        if (BotReplies.BOOK.equals(replyId)) {
            return Optional.of(lists.serviceList(0));
        }
        UUID clientId = message.clientId();
        LocalDate day = current.day();
        Instant start = current.start();
        UUID appointmentId = current.appointmentId();
        if (day == null || start == null || appointmentId == null || updatedAt == null) {
            return Optional.of(changes.menu(clientId));
        }
        if (BotReplies.moveConfirmOf(replyId)
                .filter(new IdAndStart(appointmentId, start)::equals)
                .isPresent()) {
            if (!sessions.claim(message.conversationId(), Step.CONFIRM, updatedAt, clock.instant())) {
                return Optional.empty();
            }
            return Optional.of(movable(appointmentId, clientId, start)
                    .map(target -> reschedule(target, clientId, day, start))
                    .orElseGet(() -> changes.gone(clientId)));
        }
        Optional<Upcoming> item = movable(appointmentId, clientId, start);
        if (item.isEmpty()) {
            return Optional.of(changes.gone(clientId));
        }
        if (BotReplies.OTHER_TIME.equals(replyId)) {
            return Optional.of(lists.moveTimeList(item.get(), day, null, null)
                    .orElseGet(() -> changes.gone(clientId)));
        }
        return Optional.of(new Turn(
                current, List.of(BotReplies.moveConfirmation(item.get(), start, lists.zone()))));
    }

    private Optional<Upcoming> movable(UUID appointmentId, UUID clientId, Instant start) {
        return changes.own(appointmentId, clientId).filter(item -> !item.start().equals(start));
    }

    private Turn reschedule(Upcoming target, UUID clientId, LocalDate day, Instant start) {
        AppointmentView view;
        try {
            view = appointments.reschedule(target.id(), start, EventActor.BOT);
        } catch (BookingException e) {
            return switch (e.reason()) {
                case TIME_TAKEN, OUTSIDE_SCHEDULE ->
                        lists.moveTimeList(target, day, null, new Text(BotReplies.TIME_TAKEN_TEXT))
                                .orElseGet(() -> changes.gone(clientId));
                case APPOINTMENT_NOT_FOUND, NOT_CONFIRMED -> changes.gone(clientId);
                case CLIENT_NOT_FOUND, SERVICE_NOT_FOUND, NOT_STARTED, IDEMPOTENCY_KEY_REUSED ->
                        changes.menu(clientId);
            };
        }
        return new Turn(
                BotSession.menu(), List.of(BotReplies.moved(target, view.period().start(), view.zone())));
    }
}
