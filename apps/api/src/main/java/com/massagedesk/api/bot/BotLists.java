package com.massagedesk.api.bot;

import com.massagedesk.api.bot.BotReplies.ServiceOption;
import com.massagedesk.api.bot.BotReplies.Upcoming;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.messaging.OutboundMessage;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import com.massagedesk.api.schedule.MassageService;
import com.massagedesk.api.schedule.ServiceCatalog;
import com.massagedesk.api.schedule.SlotService;
import com.massagedesk.api.schedule.SlotService.DaySlots;
import com.massagedesk.api.settings.SettingsService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Builds the service, day and time lists from free time computed by the schedule service; for a
 * moving appointment the lists use the schedule service with that appointment excluded and never
 * offer its current start.
 */
@Component
class BotLists {

    static final int DAYS_AHEAD = 30;

    private final SettingsService settings;
    private final ServiceCatalog services;
    private final SlotService slots;
    private final Clock clock;

    BotLists(
            SettingsService settings,
            ServiceCatalog services,
            SlotService slots,
            Clock clock) {
        this.settings = Objects.requireNonNull(settings, "settings");
        this.services = Objects.requireNonNull(services, "services");
        this.slots = Objects.requireNonNull(slots, "slots");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    Optional<ServiceOption> serviceById(UUID serviceId) {
        return services.all().stream()
                .filter(s -> s.getId().equals(serviceId))
                .findFirst()
                .map(s -> new ServiceOption(s.getId(), s.getName(), s.getDurationMin(), s.getPrice()));
    }

    List<ServiceOption> activeOptions() {
        return services.all().stream()
                .filter(MassageService::isActive)
                .map(s -> new ServiceOption(s.getId(), s.getName(), s.getDurationMin(), s.getPrice()))
                .toList();
    }

    Optional<ServiceOption> activeService(UUID serviceId) {
        return activeOptions().stream()
                .filter(option -> option.id().equals(serviceId))
                .findFirst();
    }

    ZoneId zone() {
        return settings.current().getTimeZone();
    }

    LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), zone());
    }

    Optional<LocalDate> pickedDay(@Nullable String replyId) {
        LocalDate today = today();
        return BotReplies.dayOf(replyId)
                .filter(d -> !d.isBefore(today) && d.isBefore(today.plusDays(DAYS_AHEAD)));
    }

    Turn serviceList(int offset) {
        List<ServiceOption> options = activeOptions();
        if (options.isEmpty()) {
            return new Turn(BotSession.menu(), List.of(BotReplies.noServices()));
        }
        return new Turn(
                new BotSession(Step.SERVICE, null, null, null, null),
                List.of(BotReplies.services(options, offset)));
    }

    private Optional<DaySlots> daySlots(
            UUID serviceId, LocalDate day, @Nullable Upcoming moving) {
        if (moving == null) {
            return slots.freeStarts(serviceId, day);
        }
        return slots.freeStarts(moving.serviceId(), day, moving.id())
                .map(s -> new DaySlots(
                        s.day(),
                        s.zone(),
                        s.duration(),
                        s.starts().stream().filter(t -> !t.equals(moving.start())).toList()));
    }

    private Optional<List<LocalDate>> freeDays(UUID serviceId, @Nullable Upcoming moving) {
        if (moving == null && activeService(serviceId).isEmpty()) {
            return Optional.empty();
        }
        LocalDate startDay = today();
        List<LocalDate> days = new ArrayList<>(BotReplies.MAX_DAYS);
        for (int i = 0; i < DAYS_AHEAD && days.size() < BotReplies.MAX_DAYS; i++) {
            LocalDate day = startDay.plusDays(i);
            Optional<DaySlots> daySlots = daySlots(serviceId, day, moving);
            if (daySlots.isEmpty()) {
                return Optional.empty();
            }
            if (!daySlots.get().starts().isEmpty()) {
                days.add(day);
            }
        }
        return Optional.of(days);
    }

    private Optional<Turn> days(
            UUID serviceId, @Nullable Upcoming moving, @Nullable OutboundMessage intro) {
        LocalDate today = today();
        Optional<List<LocalDate>> freeDays = freeDays(serviceId, moving);
        if (freeDays.isEmpty()) {
            return Optional.empty();
        }
        List<LocalDate> days = freeDays.get();
        if (days.isEmpty()) {
            return Optional.of(new Turn(BotSession.menu(), List.of(new Text(BotReplies.NO_DAYS_TEXT))));
        }
        OutboundMessage list = BotReplies.days(days, today);
        List<OutboundMessage> replies = intro == null ? List.of(list) : List.of(intro, list);
        return Optional.of(new Turn(session(Step.DAY, serviceId, null, moving), replies));
    }

    private Optional<Turn> times(
            UUID serviceId,
            @Nullable Upcoming moving,
            LocalDate day,
            @Nullable Instant after,
            @Nullable OutboundMessage intro) {
        Optional<DaySlots> daySlots = daySlots(serviceId, day, moving);
        if (daySlots.isEmpty()) {
            return Optional.empty();
        }
        List<Instant> allStarts = daySlots.get().starts();
        if (allStarts.isEmpty()) {
            return days(serviceId, moving, new Text(BotReplies.NO_TIME_TEXT));
        }
        List<Instant> pageStarts = after == null
                ? allStarts
                : allStarts.stream().filter(start -> start.isAfter(after)).toList();
        if (pageStarts.isEmpty()) {
            pageStarts = allStarts;
        }
        OutboundMessage list = BotReplies.times(day, pageStarts, daySlots.get().zone());
        List<OutboundMessage> replies = intro == null ? List.of(list) : List.of(intro, list);
        return Optional.of(new Turn(session(Step.TIME, serviceId, day, moving), replies));
    }

    private static BotSession session(
            Step step, UUID serviceId, @Nullable LocalDate day, @Nullable Upcoming moving) {
        return moving == null
                ? new BotSession(step, serviceId, day, null, null)
                : new BotSession(step, null, day, null, moving.id());
    }

    Turn dayList(UUID serviceId, @Nullable OutboundMessage intro) {
        return days(serviceId, null, intro).orElseGet(() -> serviceList(0));
    }

    Turn timeList(
            UUID serviceId,
            LocalDate day,
            @Nullable Instant after,
            @Nullable OutboundMessage intro) {
        return times(serviceId, null, day, after, intro).orElseGet(() -> serviceList(0));
    }

    Optional<List<Instant>> moveStarts(Upcoming moving, LocalDate day) {
        return daySlots(moving.serviceId(), day, moving).map(DaySlots::starts);
    }

    Optional<Turn> moveDayList(Upcoming moving, @Nullable OutboundMessage intro) {
        return days(moving.serviceId(), moving, intro);
    }

    Optional<Turn> moveTimeList(
            Upcoming moving,
            LocalDate day,
            @Nullable Instant after,
            @Nullable OutboundMessage intro) {
        return times(moving.serviceId(), moving, day, after, intro);
    }
}
