package com.massagedesk.api.bot;

import com.massagedesk.api.messaging.OutboundMessage;
import com.massagedesk.api.messaging.OutboundMessage.Button;
import com.massagedesk.api.messaging.OutboundMessage.Buttons;
import com.massagedesk.api.messaging.OutboundMessage.ListMenu;
import com.massagedesk.api.messaging.OutboundMessage.Row;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;

final class BotReplies {

    static final String MENU_TEXT = "Здравствуйте! Я помогу записаться на массаж.";
    static final String BOOK = "book";
    static final String BOOK_TITLE = "Записаться";
    static final String MOVE = "move";
    static final String MOVE_TITLE = "Перенести запись";
    static final String CANCEL = "cancel";
    static final String CANCEL_TITLE = "Отменить запись";
    static final String APPOINTMENT_PREFIX = "appointment:";
    static final String UPCOMING_HEADER = "Ваши записи:";
    static final String NO_UPCOMING_TEXT = "У вас нет предстоящих записей.";
    static final String MOVE_PICK_TEXT = "Какую запись перенести?";
    static final String CANCEL_PICK_TEXT = "Какую запись отменить?";
    static final String PICK_BUTTON = "Выбрать запись";
    static final int MAX_UPCOMING = 10;
    static final String CANCEL_CONFIRM_PREFIX = "cancel_confirm:";
    static final String KEEP = "keep";
    static final String KEEP_TITLE = "Не отменять";
    static final String MOVE_CONFIRM_PREFIX = "move_confirm:";
    static final String MOVE_CONFIRM_TITLE = "Перенести";
    static final String GONE_TEXT = "Эту запись уже изменили или отменили.";

    static final String SERVICES_TEXT = "Выберите массаж из списка.";
    static final String SERVICES_BUTTON = "Выбрать массаж";
    static final String SERVICE_PREFIX = "service:";
    static final String MORE_SERVICES_PREFIX = "more_services:";
    static final String MORE_SERVICES_TITLE = "Ещё массажи";
    static final int MAX_SERVICES = 10;
    private static final int MAX_TITLE_LENGTH = 24;
    private static final int MAX_DESCRIPTION_LENGTH = 72;

    static final String NO_SERVICES_TEXT =
            "Сейчас запись через бота недоступна. Мастер увидит ваше сообщение и ответит.";

    static final String DAYS_TEXT = "Выберите день.";
    static final String DAYS_BUTTON = "Выбрать день";
    static final String DAY_PREFIX = "day:";
    static final int MAX_DAYS = 10;

    static final String TIMES_BUTTON = "Выбрать время";
    static final String TIME_PREFIX = "time:";
    static final String MORE_TIMES_PREFIX = "more_times:";
    static final String OTHER_DAY = "other_day";
    static final int TIMES_PER_PAGE = 8;

    static final String CONFIRM_PREFIX = "confirm:";
    static final String OTHER_TIME = "other_time";

    static final String TIME_TAKEN_TEXT = "Это время уже заняли. Выберите другое.";
    static final String NO_TIME_TEXT = "В этот день свободного времени нет. Выберите другой день.";
    static final String NO_DAYS_TEXT =
            "В ближайшие 30 дней свободного времени нет. Мастер увидит ваше сообщение и ответит.";

    private static final String[] DAYS_OF_WEEK = {
        "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"
    };

    private static final String[] MONTHS = {
        "января", "февраля", "марта", "апреля", "мая", "июня",
        "июля", "августа", "сентября", "октября", "ноября", "декабря"
    };

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT);

    record ServiceOption(UUID id, String name, int durationMin, BigDecimal price) {
        ServiceOption {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(name, "name");
            Objects.requireNonNull(price, "price");
        }
    }

    record Upcoming(UUID id, UUID serviceId, String serviceName, Instant start) {
        Upcoming {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(serviceId, "serviceId");
            Objects.requireNonNull(serviceName, "serviceName");
            Objects.requireNonNull(start, "start");
        }
    }

    record IdAndStart(UUID id, Instant start) {
        IdAndStart {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(start, "start");
        }

        @Override
        public String toString() {
            return id + ":" + start;
        }
    }

    private BotReplies() {
    }

    static OutboundMessage menu() {
        return new Buttons(MENU_TEXT, List.of(new Button(BOOK, BOOK_TITLE)));
    }

    static OutboundMessage menu(List<Upcoming> upcoming, ZoneId zone) {
        Objects.requireNonNull(upcoming, "upcoming");
        Objects.requireNonNull(zone, "zone");
        if (upcoming.isEmpty()) {
            return menu();
        }
        StringBuilder body = new StringBuilder(MENU_TEXT).append("\n\n").append(UPCOMING_HEADER);
        for (Upcoming item : upcoming) {
            Objects.requireNonNull(item, "item");
            body.append('\n')
                    .append(when(item.start(), zone))
                    .append(" — ")
                    .append(title(item.serviceName()));
        }
        return new Buttons(
                body.toString(),
                List.of(
                        new Button(BOOK, BOOK_TITLE),
                        new Button(MOVE, MOVE_TITLE),
                        new Button(CANCEL, CANCEL_TITLE)));
    }

    static OutboundMessage noUpcoming() {
        return new Buttons(NO_UPCOMING_TEXT, List.of(new Button(BOOK, BOOK_TITLE)));
    }

    static OutboundMessage picks(String body, List<Upcoming> upcoming, ZoneId zone) {
        Objects.requireNonNull(body, "body");
        Objects.requireNonNull(zone, "zone");
        if (upcoming == null || upcoming.isEmpty() || upcoming.size() > MAX_UPCOMING) {
            throw new IllegalArgumentException("upcoming count must be 1.." + MAX_UPCOMING);
        }
        List<Row> rows = upcoming.stream()
                .map(item -> {
                    Objects.requireNonNull(item, "item");
                    LocalDate day = LocalDate.ofInstant(item.start(), zone);
                    String dayOfWeek = DAYS_OF_WEEK[day.getDayOfWeek().getValue() - 1];
                    String month = MONTHS[day.getMonthValue() - 1];
                    String rowTitle = day.getDayOfMonth() + " " + month + ", " + time(item.start(), zone);
                    String description =
                            truncate(dayOfWeek + " · " + item.serviceName(), MAX_DESCRIPTION_LENGTH);
                    return new Row(APPOINTMENT_PREFIX + item.id(), rowTitle, description);
                })
                .toList();
        return new ListMenu(body, PICK_BUTTON, rows);
    }

    static OutboundMessage cancelConfirmation(Upcoming item, ZoneId zone) {
        Objects.requireNonNull(item, "item");
        Objects.requireNonNull(zone, "zone");
        return new Buttons(
                "Отменить запись?\n" + item.serviceName() + "\n" + when(item.start(), zone),
                List.of(
                        new Button(CANCEL_CONFIRM_PREFIX + item.id(), CANCEL_TITLE),
                        new Button(KEEP, KEEP_TITLE)));
    }

    static OutboundMessage cancelled(Upcoming item, ZoneId zone) {
        Objects.requireNonNull(item, "item");
        Objects.requireNonNull(zone, "zone");
        return new Buttons(
                "Запись отменена:\n" + item.serviceName() + "\n" + when(item.start(), zone),
                List.of(new Button(BOOK, BOOK_TITLE)));
    }

    static OutboundMessage moveConfirmation(Upcoming item, Instant start, ZoneId zone) {
        Objects.requireNonNull(item, "item");
        Objects.requireNonNull(start, "start");
        Objects.requireNonNull(zone, "zone");
        return new Buttons(
                "Перенести запись?\n"
                        + item.serviceName()
                        + "\nСейчас: "
                        + when(item.start(), zone)
                        + "\nНовое время: "
                        + when(start, zone),
                List.of(
                        new Button(
                                MOVE_CONFIRM_PREFIX + new IdAndStart(item.id(), start),
                                MOVE_CONFIRM_TITLE),
                        new Button(OTHER_TIME, "Другое время")));
    }

    static OutboundMessage moved(Upcoming item, Instant start, ZoneId zone) {
        Objects.requireNonNull(item, "item");
        Objects.requireNonNull(start, "start");
        Objects.requireNonNull(zone, "zone");
        return new Text(
                "Запись перенесена:\n" + item.serviceName() + "\n" + when(start, zone) + "\nЖдём вас!");
    }

    static OutboundMessage tooLateToCancel(Duration cutoff) {
        return new Text(
                "До начала записи меньше "
                        + minutes(cutoff)
                        + ", поэтому отменить её через бота уже нельзя. "
                        + "Если не можете прийти, напишите здесь — мастер увидит ваше сообщение и ответит.");
    }

    static OutboundMessage tooLateToMove(Duration cutoff) {
        return new Text(
                "До начала записи меньше "
                        + minutes(cutoff)
                        + ", поэтому перенести её через бота уже нельзя. "
                        + "Если не успеваете, напишите здесь — мастер увидит ваше сообщение и ответит.");
    }

    static String minutes(Duration cutoff) {
        Objects.requireNonNull(cutoff, "cutoff");
        long n = cutoff.toMinutes();
        String word = n % 10 == 1 && n % 100 != 11 ? "минуты" : "минут";
        return n + " " + word;
    }

    static OutboundMessage services(List<ServiceOption> options) {
        return services(options, 0);
    }

    static OutboundMessage services(List<ServiceOption> options, int offset) {
        if (options == null || options.isEmpty()) {
            throw new IllegalArgumentException("options must not be empty");
        }
        int start = offset >= 0 && offset < options.size() ? offset : 0;
        int remaining = options.size() - start;
        int count = remaining <= MAX_SERVICES ? remaining : MAX_SERVICES - 1;
        List<Row> rows = new ArrayList<>(count + 1);
        for (int i = 0; i < count; i++) {
            ServiceOption option = Objects.requireNonNull(options.get(start + i), "option");
            rows.add(new Row(SERVICE_PREFIX + option.id(), title(option.name()), details(option)));
        }
        if (remaining > MAX_SERVICES) {
            rows.add(new Row(MORE_SERVICES_PREFIX + (start + count), MORE_SERVICES_TITLE, null));
        }
        return new ListMenu(SERVICES_TEXT, SERVICES_BUTTON, rows);
    }

    static String details(ServiceOption option) {
        Objects.requireNonNull(option, "option");
        return option.durationMin() + "\u00a0мин · " + price(option.price()) + "\u00a0₸";
    }

    static OutboundMessage noServices() {
        return new Text(NO_SERVICES_TEXT);
    }

    static OutboundMessage days(List<LocalDate> days, LocalDate today) {
        Objects.requireNonNull(today, "today");
        if (days == null || days.isEmpty() || days.size() > MAX_DAYS) {
            throw new IllegalArgumentException("days count must be 1.." + MAX_DAYS);
        }
        LocalDate tomorrow = today.plusDays(1);
        List<Row> rows = days.stream()
                .map(day -> {
                    Objects.requireNonNull(day, "day");
                    String description = null;
                    if (day.equals(today)) {
                        description = "Сегодня";
                    } else if (day.equals(tomorrow)) {
                        description = "Завтра";
                    }
                    return new Row(DAY_PREFIX + day, dayTitle(day), description);
                })
                .toList();
        return new ListMenu(DAYS_TEXT, DAYS_BUTTON, rows);
    }

    static OutboundMessage times(LocalDate day, List<Instant> starts, ZoneId zone) {
        Objects.requireNonNull(day, "day");
        Objects.requireNonNull(zone, "zone");
        if (starts == null || starts.isEmpty()) {
            throw new IllegalArgumentException("starts must not be empty");
        }
        Instant previous = null;
        for (Instant start : starts) {
            Objects.requireNonNull(start, "start");
            if (previous != null && !start.isAfter(previous)) {
                throw new IllegalArgumentException("starts must be in ascending order");
            }
            previous = start;
        }
        int shownCount = Math.min(starts.size(), TIMES_PER_PAGE);
        List<Row> rows = new ArrayList<>(shownCount + 2);
        for (int i = 0; i < shownCount; i++) {
            Instant start = starts.get(i);
            rows.add(new Row(TIME_PREFIX + start, time(start, zone), null));
        }
        if (starts.size() > TIMES_PER_PAGE) {
            Instant lastShown = starts.get(TIMES_PER_PAGE - 1);
            rows.add(new Row(MORE_TIMES_PREFIX + lastShown, "Позже", "Ещё время в этот день"));
        }
        rows.add(new Row(OTHER_DAY, "Другой день", null));
        return new ListMenu(dayTitle(day) + ". Выберите время.", TIMES_BUTTON, rows);
    }

    static OutboundMessage confirmation(ServiceOption option, Instant start, ZoneId zone) {
        return new Buttons(
                "Проверьте запись:\n" + lines(option, start, zone),
                List.of(
                        new Button(CONFIRM_PREFIX + option.id() + ":" + start, "Подтвердить"),
                        new Button(OTHER_TIME, "Другое время")));
    }

    static OutboundMessage booked(ServiceOption option, Instant start, ZoneId zone) {
        return new Text("Вы записаны:\n" + lines(option, start, zone) + "\nЖдём вас!");
    }

    private static String lines(ServiceOption option, Instant start, ZoneId zone) {
        Objects.requireNonNull(option, "option");
        return option.name() + "\n" + when(start, zone) + "\n" + details(option);
    }

    static String when(Instant start, ZoneId zone) {
        Objects.requireNonNull(start, "start");
        Objects.requireNonNull(zone, "zone");
        LocalDate day = LocalDate.ofInstant(start, zone);
        return dayTitle(day) + ", " + time(start, zone);
    }

    static String dayTitle(LocalDate day) {
        Objects.requireNonNull(day, "day");
        String dayOfWeek = DAYS_OF_WEEK[day.getDayOfWeek().getValue() - 1];
        String month = MONTHS[day.getMonthValue() - 1];
        return dayOfWeek + ", " + day.getDayOfMonth() + " " + month;
    }

    static String time(Instant start, ZoneId zone) {
        Objects.requireNonNull(start, "start");
        Objects.requireNonNull(zone, "zone");
        return TIME_FORMAT.withZone(zone).format(start);
    }

    static Optional<UUID> appointmentIdOf(@Nullable String replyId) {
        return parseCanonical(replyId, APPOINTMENT_PREFIX, UUID::fromString);
    }

    static Optional<UUID> cancelConfirmOf(@Nullable String replyId) {
        return parseCanonical(replyId, CANCEL_CONFIRM_PREFIX, UUID::fromString);
    }

    static Optional<IdAndStart> moveConfirmOf(@Nullable String replyId) {
        return parseCanonical(replyId, MOVE_CONFIRM_PREFIX, BotReplies::parseIdAndStart);
    }

    static Optional<UUID> serviceIdOf(@Nullable String replyId) {
        return parseCanonical(replyId, SERVICE_PREFIX, UUID::fromString);
    }

    static Optional<Integer> moreServicesOffsetOf(@Nullable String replyId) {
        return parseCanonical(replyId, MORE_SERVICES_PREFIX, Integer::valueOf)
                .filter(offset -> offset >= 0);
    }

    static Optional<LocalDate> dayOf(@Nullable String replyId) {
        return parseCanonical(replyId, DAY_PREFIX, LocalDate::parse);
    }

    static Optional<Instant> timeOf(@Nullable String replyId) {
        return parseCanonical(replyId, TIME_PREFIX, Instant::parse);
    }

    static Optional<Instant> moreTimesAfterOf(@Nullable String replyId) {
        return parseCanonical(replyId, MORE_TIMES_PREFIX, Instant::parse);
    }

    static Optional<IdAndStart> confirmationOf(@Nullable String replyId) {
        return parseCanonical(replyId, CONFIRM_PREFIX, BotReplies::parseIdAndStart);
    }

    private static IdAndStart parseIdAndStart(String raw) {
        if (raw.length() < 38 || raw.charAt(36) != ':') {
            throw new IllegalArgumentException("not id:start");
        }
        return new IdAndStart(UUID.fromString(raw.substring(0, 36)), Instant.parse(raw.substring(37)));
    }

    private static <T> Optional<T> parseCanonical(
            @Nullable String replyId, String prefix, Function<String, T> parser) {
        if (replyId == null || !replyId.startsWith(prefix)) {
            return Optional.empty();
        }
        String raw = replyId.substring(prefix.length());
        if (raw.isEmpty()) {
            return Optional.empty();
        }
        try {
            T parsed = parser.apply(raw);
            return parsed.toString().equals(raw) ? Optional.of(parsed) : Optional.empty();
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    static String title(String name) {
        return truncate(Objects.requireNonNull(name, "name"), MAX_TITLE_LENGTH);
    }

    private static String truncate(String text, int maxLength) {
        Objects.requireNonNull(text, "text");
        if (text.codePointCount(0, text.length()) <= maxLength) {
            return text;
        }
        int endIndex = text.offsetByCodePoints(0, maxLength - 1);
        return text.substring(0, endIndex) + "…";
    }

    static String price(BigDecimal price) {
        Objects.requireNonNull(price, "price");
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.ROOT);
        symbols.setGroupingSeparator('\u00a0');
        symbols.setDecimalSeparator(',');
        return new DecimalFormat("#,##0.##", symbols).format(price);
    }
}
