package com.massagedesk.api.bot;

import com.massagedesk.api.bot.BotReplies.ServiceOption;
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
 * Builds the service, day and time lists from free time computed by the schedule service.
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

    Turn serviceList(int offset) {
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

    Turn dayList(UUID serviceId, @Nullable OutboundMessage intro) {
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

    Turn timeList(
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
