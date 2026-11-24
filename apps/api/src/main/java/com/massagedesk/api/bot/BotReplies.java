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
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

final class BotReplies {

    static final String MENU_TEXT = "Здравствуйте! Я помогу записаться на массаж.";
    static final String BOOK = "book";
    static final String BOOK_TITLE = "Записаться";

    static final String SERVICES_TEXT = "Выберите массаж из списка.";
    static final String SERVICES_BUTTON = "Выбрать массаж";
    static final String SERVICE_PREFIX = "service:";
    static final int MAX_SERVICES = 10;
    private static final int MAX_TITLE_LENGTH = 24;

    static final String NO_SERVICES_TEXT =
            "Сейчас запись через бота недоступна. Мастер увидит ваше сообщение и ответит.";

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
