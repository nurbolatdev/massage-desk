package com.massagedesk.api.bot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.bot.BotReplies.ServiceOption;
import com.massagedesk.api.messaging.OutboundMessage.Button;
import com.massagedesk.api.messaging.OutboundMessage.Buttons;
import com.massagedesk.api.messaging.OutboundMessage.ListMenu;
import com.massagedesk.api.messaging.OutboundMessage.Row;
import com.massagedesk.api.messaging.OutboundMessage.Text;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class BotRepliesTests {

    @Test
    void menuContainsGreetingAndBookButton() {
        assertThat(BotReplies.menu())
                .isEqualTo(new Buttons(
                        "Здравствуйте! Я помогу записаться на массаж.",
                        List.of(new Button("book", "Записаться"))));
    }

    @Test
    void servicesTakesAtMostTenOptionsInOrderWithFormattedRows() {
        List<ServiceOption> twelve = IntStream.rangeClosed(1, 12)
                .mapToObj(i -> new ServiceOption(
                        UUID.fromString("00000000-0000-0000-0000-%012d".formatted(i)),
                        "Массаж №" + i,
                        60,
                        new BigDecimal("8000.00")))
                .toList();

        ListMenu menu = (ListMenu) BotReplies.services(twelve);

        assertThat(menu.body()).isEqualTo("Выберите массаж из списка.");
        assertThat(menu.buttonLabel()).isEqualTo("Выбрать массаж");
        assertThat(menu.rows()).hasSize(10);
        assertThat(menu.rows().get(0))
                .isEqualTo(new Row(
                        "service:00000000-0000-0000-0000-000000000001",
                        "Массаж №1",
                        "60\u00a0мин · 8\u00a0000\u00a0₸"));
        assertThat(menu.rows().get(9).id())
                .isEqualTo("service:00000000-0000-0000-0000-000000000010");
    }

    @Test
    void servicesRejectsEmptyList() {
        assertThatThrownBy(() -> BotReplies.services(List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void titleKeepsUpToTwentyFourCharactersAndTruncatesLongerWithEllipsis() {
        String twentyFour = "Классический массаж спин";
        String twentyFive = "Классический массаж спины";

        assertThat(twentyFour).hasSize(24);
        assertThat(twentyFive).hasSize(25);
        assertThat(BotReplies.title(twentyFour)).isEqualTo("Классический массаж спин");
        assertThat(BotReplies.title(twentyFive))
                .isEqualTo("Классический массаж спи…")
                .hasSize(24);
    }

    @Test
    void priceFormatsThousandsWithNonBreakingSpaceAndFractionWithComma() {
        assertThat(BotReplies.price(new BigDecimal("8000.00"))).isEqualTo("8\u00a0000");
        assertThat(BotReplies.price(new BigDecimal("150000"))).isEqualTo("150\u00a0000");
        assertThat(BotReplies.price(new BigDecimal("1234.50"))).isEqualTo("1\u00a0234,5");
    }

    @Test
    void noServicesReturnsPlainRussianTextWithoutJargon() {
        assertThat(BotReplies.noServices())
                .isEqualTo(new Text(
                        "Сейчас запись через бота недоступна. Мастер увидит ваше сообщение и ответит."));
    }
}
