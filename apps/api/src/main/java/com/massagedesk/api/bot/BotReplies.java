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

    static final String SERVICES_TEXT = "Выберите массаж из списка.";
    static final String SERVICES_BUTTON = "Выбрать массаж";
    static final String SERVICE_PREFIX = "service:";
    static final String MORE_SERVICES_PREFIX = "more_services:";
    static final String MORE_SERVICES_TITLE = "Ещё массажи";
    static final int MAX_SERVICES = 10;
    private static final int MAX_TITLE_LENGTH = 24;

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

    static final String CONFIRM = "confirm";
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

    private BotReplies() {
    }

    static OutboundMessage menu() {
        return new Buttons(MENU_TEXT, List.of(new Button(BOOK, BOOK_TITLE)));
    }

    static OutboundMessage services(List<ServiceOption> options) {
        if (options == null || options.isEmpty()) {
            throw new IllegalArgumentException("options must not be empty");
        }
        List<Row> rows = options.stream()
                .limit(MAX_SERVICES)
                .map(option -> {
                    Objects.requireNonNull(option, "option");
                    String description = option.durationMin() + "\u00a0мин · " + price(option.price()) + "\u00a0₸";
                    return new Row(SERVICE_PREFIX + option.id(), title(option.name()), description);
                })
                .toList();
        return new ListMenu(SERVICES_TEXT, SERVICES_BUTTON, rows);
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
        Objects.requireNonNull(name, "name");
        if (name.codePointCount(0, name.length()) <= MAX_TITLE_LENGTH) {
            return name;
        }
        int endIndex = name.offsetByCodePoints(0, MAX_TITLE_LENGTH - 1);
        return name.substring(0, endIndex) + "…";
    }

    static String price(BigDecimal price) {
        Objects.requireNonNull(price, "price");
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.ROOT);
        symbols.setGroupingSeparator('\u00a0');
        symbols.setDecimalSeparator(',');
        return new DecimalFormat("#,##0.##", symbols).format(price);
    }
}
