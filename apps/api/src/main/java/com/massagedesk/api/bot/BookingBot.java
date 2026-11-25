package com.massagedesk.api.bot;

import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.AppointmentService.AppointmentView;
import com.massagedesk.api.booking.AppointmentService.RequestKey;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.booking.BookingException;
import com.massagedesk.api.bot.BotReplies.IdAndStart;
import com.massagedesk.api.bot.BotReplies.ServiceOption;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.bot.BotSessionStore.Loaded;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.ClientMessageReceived;
import com.massagedesk.api.messaging.OutboundMessage;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import com.massagedesk.api.messaging.OutboundMessages;
import com.massagedesk.api.messaging.OutboundMessages.Author;
import com.massagedesk.api.schedule.SlotService;
import com.massagedesk.api.schedule.SlotService.DaySlots;
import com.massagedesk.api.settings.SettingsService;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Button booking conversation; silent when the bot is off or the master took over.
 * Free time comes from the schedule service; bookings go through the appointment service with an
 * idempotency key, so a repeated confirmation never books twice.
 * State is saved before replies, and replies are sent outside any transaction.
 */
@Service
class BookingBot {

    static final Duration SESSION_LIFETIME = Duration.ofHours(24);
    static final UUID BOT_REQUEST_USER =
            UUID.nameUUIDFromBytes("massage-desk-bot".getBytes(StandardCharsets.UTF_8));

    private final SettingsService settings;
    private final BotSessionStore sessions;
    private final BotLists lists;
    private final SlotService slots;
    private final AppointmentService appointments;
    private final OutboundMessages outbound;
    private final Clock clock;

    BookingBot(
            SettingsService settings,
            BotSessionStore sessions,
            BotLists lists,
            SlotService slots,
            AppointmentService appointments,
            OutboundMessages outbound,
            Clock clock) {
        this.settings = Objects.requireNonNull(settings, "settings");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.lists = Objects.requireNonNull(lists, "lists");
        this.slots = Objects.requireNonNull(slots, "slots");
        this.appointments = Objects.requireNonNull(appointments, "appointments");
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
        Turn turn = next(current, loaded.get().updatedAt(), message);
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

    private Turn next(
            BotSession current, @Nullable Instant updatedAt, ClientMessageReceived message) {
        return switch (current.step()) {
            case MENU -> BotReplies.BOOK.equals(message.replyId()) ? lists.serviceList(0) : menuTurn();
            case SERVICE -> onService(message.replyId());
            case DAY -> onDay(current, message.replyId());
            case TIME -> onTime(current, message.replyId());
            case CONFIRM -> onConfirm(current, updatedAt, message);
            case MOVE_PICK, CANCEL_PICK, CANCEL_CONFIRM -> menuTurn();
        };
    }

    private Turn onService(@Nullable String replyId) {
        Optional<UUID> serviceId = BotReplies.serviceIdOf(replyId);
        if (serviceId.isPresent()) {
            return lists.activeService(serviceId.get()).isPresent()
                    ? lists.dayList(serviceId.get(), null)
                    : lists.serviceList(0);
        }
        return lists.serviceList(BotReplies.moreServicesOffsetOf(replyId).orElse(0));
    }

    private Turn onDay(BotSession current, @Nullable String replyId) {
        UUID serviceId = current.serviceId();
        if (serviceId == null) {
            return menuTurn();
        }
        LocalDate today = lists.today();
        Optional<LocalDate> day = BotReplies.dayOf(replyId)
                .filter(d -> !d.isBefore(today) && d.isBefore(today.plusDays(BotLists.DAYS_AHEAD)));
        if (day.isPresent()) {
            return lists.timeList(serviceId, day.get(), null, null);
        }
        return lists.dayList(serviceId, null);
    }

    private Turn onTime(BotSession current, @Nullable String replyId) {
        UUID serviceId = current.serviceId();
        LocalDate day = current.day();
        if (serviceId == null || day == null) {
            return menuTurn();
        }
        Optional<Instant> start = BotReplies.timeOf(replyId);
        if (start.isPresent()) {
            if (!LocalDate.ofInstant(start.get(), lists.zone()).equals(day)) {
                return lists.timeList(serviceId, day, null, null);
            }
            Optional<ServiceOption> option = lists.activeService(serviceId);
            Optional<DaySlots> daySlots = slots.freeStarts(serviceId, day);
            if (option.isEmpty() || daySlots.isEmpty()) {
                return lists.serviceList(0);
            }
            if (daySlots.get().starts().contains(start.get())) {
                return new Turn(
                        new BotSession(Step.CONFIRM, serviceId, day, start.get(), null),
                        List.of(BotReplies.confirmation(option.get(), start.get(), daySlots.get().zone())));
            }
            return lists.timeList(serviceId, day, null, new Text(BotReplies.TIME_TAKEN_TEXT));
        }
        Optional<Instant> after = BotReplies.moreTimesAfterOf(replyId);
        if (after.isPresent()) {
            return lists.timeList(serviceId, day, after.get(), null);
        }
        if (BotReplies.OTHER_DAY.equals(replyId)) {
            return lists.dayList(serviceId, null);
        }
        return lists.timeList(serviceId, day, null, null);
    }

    private Turn onConfirm(
            BotSession current, @Nullable Instant updatedAt, ClientMessageReceived message) {
        UUID serviceId = current.serviceId();
        LocalDate day = current.day();
        Instant start = current.start();
        if (serviceId == null || day == null || start == null || updatedAt == null) {
            return menuTurn();
        }
        if (BotReplies.confirmationOf(message.replyId())
                .filter(new IdAndStart(serviceId, start)::equals)
                .isPresent()) {
            return confirmBooking(message, serviceId, day, start, updatedAt);
        }
        if (BotReplies.OTHER_TIME.equals(message.replyId())) {
            return lists.timeList(serviceId, day, null, null);
        }
        return lists.activeService(serviceId)
                .map(option -> new Turn(
                        current, List.of(BotReplies.confirmation(option, start, lists.zone()))))
                .orElseGet(() -> lists.serviceList(0));
    }

    private Turn confirmBooking(
            ClientMessageReceived message,
            UUID serviceId,
            LocalDate day,
            Instant start,
            Instant updatedAt) {
        UUID key = UUID.nameUUIDFromBytes(
                (message.conversationId() + "|" + serviceId + "|" + start + "|" + updatedAt)
                        .getBytes(StandardCharsets.UTF_8));
        AppointmentView view;
        try {
            view = appointments.create(
                    message.clientId(),
                    serviceId,
                    start,
                    AppointmentSource.BOT,
                    EventActor.BOT,
                    new RequestKey(BOT_REQUEST_USER, key));
        } catch (BookingException e) {
            return switch (e.reason()) {
                case TIME_TAKEN, OUTSIDE_SCHEDULE ->
                        lists.timeList(serviceId, day, null, new Text(BotReplies.TIME_TAKEN_TEXT));
                case SERVICE_NOT_FOUND -> lists.serviceList(0);
                case CLIENT_NOT_FOUND,
                        APPOINTMENT_NOT_FOUND,
                        NOT_CONFIRMED,
                        NOT_STARTED,
                        IDEMPOTENCY_KEY_REUSED -> menuTurn();
            };
        }
        return lists.serviceById(view.serviceId())
                .map(option -> new Turn(
                        BotSession.menu(),
                        List.of(BotReplies.booked(option, view.period().start(), view.zone()))))
                .orElseGet(BookingBot::menuTurn);
    }

    private static Turn menuTurn() {
        return new Turn(BotSession.menu(), List.of(BotReplies.menu()));
    }
}
