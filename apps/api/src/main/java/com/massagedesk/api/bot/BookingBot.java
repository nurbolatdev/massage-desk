package com.massagedesk.api.bot;

import com.massagedesk.api.booking.AppointmentService;
import com.massagedesk.api.booking.AppointmentService.AppointmentView;
import com.massagedesk.api.booking.AppointmentService.RequestKey;
import com.massagedesk.api.booking.AppointmentSource;
import com.massagedesk.api.booking.BookingException;
import com.massagedesk.api.bot.BotReplies.ServiceOption;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.bot.BotSessionStore.Loaded;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.messaging.ClientMessageReceived;
import com.massagedesk.api.messaging.OutboundMessage;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import com.massagedesk.api.messaging.OutboundMessages;
import com.massagedesk.api.messaging.OutboundMessages.Author;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.ServiceCatalog;
import com.massagedesk.api.schedule.SlotService;
import com.massagedesk.api.schedule.SlotService.DaySlots;
import com.massagedesk.api.settings.SettingsService;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
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
    static final int DAYS_AHEAD = 30;
    static final UUID BOT_REQUEST_USER =
            UUID.nameUUIDFromBytes("massage-desk-bot".getBytes(StandardCharsets.UTF_8));

    record Turn(BotSession next, List<OutboundMessage> replies) {
        Turn {
            Objects.requireNonNull(next, "next");
            replies = List.copyOf(Objects.requireNonNull(replies, "replies"));
        }
    }

    private final SettingsService settings;
    private final BotSessionStore sessions;
    private final ServiceCatalog services;
    private final SlotService slots;
    private final AppointmentService appointments;
    private final OutboundMessages outbound;
    private final Clock clock;

    BookingBot(
            SettingsService settings,
            BotSessionStore sessions,
            ServiceCatalog services,
            SlotService slots,
            AppointmentService appointments,
            OutboundMessages outbound,
            Clock clock) {
        this.settings = Objects.requireNonNull(settings, "settings");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.services = Objects.requireNonNull(services, "services");
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
            case MENU -> BotReplies.BOOK.equals(message.replyId()) ? serviceList(0) : menuTurn();
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
            return activeService(serviceId.get()).isPresent()
                    ? dayList(serviceId.get(), null)
                    : serviceList(0);
        }
        return serviceList(BotReplies.moreServicesOffsetOf(replyId).orElse(0));
    }

    private Turn onDay(BotSession current, @Nullable String replyId) {
        UUID serviceId = current.serviceId();
        if (serviceId == null) {
            return menuTurn();
        }
        LocalDate today = today();
        Optional<LocalDate> day = BotReplies.dayOf(replyId)
                .filter(d -> !d.isBefore(today) && d.isBefore(today.plusDays(DAYS_AHEAD)));
        if (day.isPresent()) {
            return timeList(serviceId, day.get(), null, null);
        }
        return dayList(serviceId, null);
    }

    private Turn onTime(BotSession current, @Nullable String replyId) {
        UUID serviceId = current.serviceId();
        LocalDate day = current.day();
        if (serviceId == null || day == null) {
            return menuTurn();
        }
        Optional<Instant> start = BotReplies.timeOf(replyId);
        if (start.isPresent()) {
            if (!LocalDate.ofInstant(start.get(), zone()).equals(day)) {
                return timeList(serviceId, day, null, null);
            }
            Optional<ServiceOption> option = activeService(serviceId);
            Optional<DaySlots> daySlots = slots.freeStarts(serviceId, day);
            if (option.isEmpty() || daySlots.isEmpty()) {
                return serviceList(0);
            }
            if (daySlots.get().starts().contains(start.get())) {
                return new Turn(
                        new BotSession(Step.CONFIRM, serviceId, day, start.get(), null),
                        List.of(BotReplies.confirmation(option.get(), start.get(), daySlots.get().zone())));
            }
            return timeList(serviceId, day, null, new Text(BotReplies.TIME_TAKEN_TEXT));
        }
        Optional<Instant> after = BotReplies.moreTimesAfterOf(replyId);
        if (after.isPresent()) {
            return timeList(serviceId, day, after.get(), null);
        }
        if (BotReplies.OTHER_DAY.equals(replyId)) {
            return dayList(serviceId, null);
        }
        return timeList(serviceId, day, null, null);
    }

    private Turn onConfirm(
            BotSession current, @Nullable Instant updatedAt, ClientMessageReceived message) {
        UUID serviceId = current.serviceId();
        LocalDate day = current.day();
        Instant start = current.start();
        if (serviceId == null || day == null || start == null || updatedAt == null) {
            return menuTurn();
        }
        if (BotReplies.confirmedStartOf(message.replyId()).filter(start::equals).isPresent()) {
            return confirmBooking(message, serviceId, day, start, updatedAt);
        }
        if (BotReplies.OTHER_TIME.equals(message.replyId())) {
            return timeList(serviceId, day, null, null);
        }
        return activeService(serviceId)
                .map(option -> new Turn(
                        current, List.of(BotReplies.confirmation(option, start, zone()))))
                .orElseGet(() -> serviceList(0));
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
                        timeList(serviceId, day, null, new Text(BotReplies.TIME_TAKEN_TEXT));
                case SERVICE_NOT_FOUND -> serviceList(0);
                case CLIENT_NOT_FOUND,
                        APPOINTMENT_NOT_FOUND,
                        NOT_CONFIRMED,
                        NOT_STARTED,
                        IDEMPOTENCY_KEY_REUSED -> menuTurn();
            };
        }
        return serviceById(view.serviceId())
                .map(option -> new Turn(
                        BotSession.menu(),
                        List.of(BotReplies.booked(option, view.period().start(), view.zone()))))
                .orElseGet(BookingBot::menuTurn);
    }

    private static Turn menuTurn() {
        return new Turn(BotSession.menu(), List.of(BotReplies.menu()));
    }

    private Optional<ServiceOption> serviceById(UUID serviceId) {
        return services.all().stream()
                .filter(s -> s.getId().equals(serviceId))
                .findFirst()
                .map(s -> new ServiceOption(s.getId(), s.getName(), s.getDurationMin(), s.getPrice()));
    }

    private List<ServiceOption> activeOptions() {
        return services.all().stream()
                .filter(MassageService::isActive)
                .map(s -> new ServiceOption(s.getId(), s.getName(), s.getDurationMin(), s.getPrice()))
                .toList();
    }

    private Optional<ServiceOption> activeService(UUID serviceId) {
        return activeOptions().stream()
                .filter(option -> option.id().equals(serviceId))
                .findFirst();
    }

    private ZoneId zone() {
        return settings.current().getTimeZone();
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), zone());
    }

    private Turn serviceList(int offset) {
        List<ServiceOption> options = activeOptions();
        if (options.isEmpty()) {
            return new Turn(BotSession.menu(), List.of(BotReplies.noServices()));
        }
        return new Turn(
                new BotSession(Step.SERVICE, null, null, null, null),
                List.of(BotReplies.services(options, offset)));
    }

    private Optional<List<LocalDate>> freeDays(UUID serviceId) {
        if (activeService(serviceId).isEmpty()) {
            return Optional.empty();
        }
        LocalDate startDay = today();
        List<LocalDate> days = new ArrayList<>(BotReplies.MAX_DAYS);
        for (int i = 0; i < DAYS_AHEAD && days.size() < BotReplies.MAX_DAYS; i++) {
            LocalDate day = startDay.plusDays(i);
            Optional<DaySlots> daySlots = slots.freeStarts(serviceId, day);
            if (daySlots.isEmpty()) {
                return Optional.empty();
            }
            if (!daySlots.get().starts().isEmpty()) {
                days.add(day);
            }
        }
        return Optional.of(days);
    }

    private Turn dayList(UUID serviceId, @Nullable OutboundMessage intro) {
        LocalDate today = today();
        Optional<List<LocalDate>> freeDays = freeDays(serviceId);
        if (freeDays.isEmpty()) {
            return serviceList(0);
        }
        List<LocalDate> days = freeDays.get();
        if (days.isEmpty()) {
            return new Turn(BotSession.menu(), List.of(new Text(BotReplies.NO_DAYS_TEXT)));
        }
        OutboundMessage list = BotReplies.days(days, today);
        List<OutboundMessage> replies = intro == null ? List.of(list) : List.of(intro, list);
        return new Turn(new BotSession(Step.DAY, serviceId, null, null, null), replies);
    }

    private Turn timeList(
            UUID serviceId,
            LocalDate day,
            @Nullable Instant after,
            @Nullable OutboundMessage intro) {
        Optional<DaySlots> daySlots = slots.freeStarts(serviceId, day);
        if (daySlots.isEmpty()) {
            return serviceList(0);
        }
        List<Instant> allStarts = daySlots.get().starts();
        if (allStarts.isEmpty()) {
            return dayList(serviceId, new Text(BotReplies.NO_TIME_TEXT));
        }
        List<Instant> pageStarts = after == null
                ? allStarts
                : allStarts.stream().filter(start -> start.isAfter(after)).toList();
        if (pageStarts.isEmpty()) {
            pageStarts = allStarts;
        }
        OutboundMessage list = BotReplies.times(day, pageStarts, daySlots.get().zone());
        List<OutboundMessage> replies = intro == null ? List.of(list) : List.of(intro, list);
        return new Turn(new BotSession(Step.TIME, serviceId, day, null, null), replies);
    }
}
