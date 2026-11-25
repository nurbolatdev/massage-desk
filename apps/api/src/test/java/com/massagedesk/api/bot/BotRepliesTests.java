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
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
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

    @Test
    void dayTitleFormatsAllDaysOfWeekAndMonthsWithinRowLimit() {
        assertThat(BotReplies.dayTitle(LocalDate.of(2026, 11, 3))).isEqualTo("Вторник, 3 ноября");
        assertThat(BotReplies.dayTitle(LocalDate.of(2026, 9, 27))).isEqualTo("Воскресенье, 27 сентября");
        assertThat(IntStream.rangeClosed(2, 8)
                        .mapToObj(d -> BotReplies.dayTitle(LocalDate.of(2026, 11, d)))
                        .toList())
                .containsExactly(
                        "Понедельник, 2 ноября",
                        "Вторник, 3 ноября",
                        "Среда, 4 ноября",
                        "Четверг, 5 ноября",
                        "Пятница, 6 ноября",
                        "Суббота, 7 ноября",
                        "Воскресенье, 8 ноября");
        assertThat(IntStream.rangeClosed(1, 12)
                        .mapToObj(m -> BotReplies.dayTitle(LocalDate.of(2026, m, 1)).split(" ")[2])
                        .toList())
                .containsExactly(
                        "января", "февраля", "марта", "апреля", "мая", "июня",
                        "июля", "августа", "сентября", "октября", "ноября", "декабря");

        String longest = BotReplies.dayTitle(LocalDate.of(2029, 9, 30));
        assertThat(longest).isEqualTo("Воскресенье, 30 сентября").hasSize(24);
        assertThat(new Row("day:2029-09-30", longest, null).title()).isEqualTo(longest);
    }

    @Test
    void timeFormatsInstantInRequestedZone() {
        Instant start = Instant.parse("2026-11-03T05:00:00Z");
        assertThat(BotReplies.time(start, ZoneId.of("Asia/Tashkent"))).isEqualTo("10:00");
        assertThat(BotReplies.time(start, ZoneOffset.UTC)).isEqualTo("05:00");
    }

    @Test
    void daysBuildsListWithTodayAndTomorrowDescriptionsAndValidatesBounds() {
        List<LocalDate> dates = List.of(
                LocalDate.of(2026, 11, 3),
                LocalDate.of(2026, 11, 4),
                LocalDate.of(2026, 11, 10));

        assertThat(BotReplies.days(dates, LocalDate.of(2026, 11, 1)))
                .isEqualTo(new ListMenu(
                        "Выберите день.",
                        "Выбрать день",
                        List.of(
                                new Row("day:2026-11-03", "Вторник, 3 ноября", null),
                                new Row("day:2026-11-04", "Среда, 4 ноября", null),
                                new Row("day:2026-11-10", "Вторник, 10 ноября", null))));
        assertThat(BotReplies.days(dates, LocalDate.of(2026, 11, 2)))
                .isEqualTo(new ListMenu(
                        "Выберите день.",
                        "Выбрать день",
                        List.of(
                                new Row("day:2026-11-03", "Вторник, 3 ноября", "Завтра"),
                                new Row("day:2026-11-04", "Среда, 4 ноября", null),
                                new Row("day:2026-11-10", "Вторник, 10 ноября", null))));
        assertThat(((ListMenu) BotReplies.days(dates, LocalDate.of(2026, 11, 3))).rows())
                .containsExactly(
                        new Row("day:2026-11-03", "Вторник, 3 ноября", "Сегодня"),
                        new Row("day:2026-11-04", "Среда, 4 ноября", "Завтра"),
                        new Row("day:2026-11-10", "Вторник, 10 ноября", null));

        List<LocalDate> eleven = IntStream.range(0, 11)
                .mapToObj(LocalDate.of(2026, 11, 2)::plusDays)
                .toList();
        assertThatThrownBy(() -> BotReplies.days(List.of(), LocalDate.of(2026, 11, 2)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BotReplies.days(eleven, LocalDate.of(2026, 11, 2)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void timesPaginatesUpToEightStartsAndAddsMoreAndOtherDayRows() {
        ZoneId tashkent = ZoneId.of("Asia/Tashkent");
        LocalDate day = LocalDate.of(2026, 11, 3);
        Instant first = Instant.parse("2026-11-03T05:00:00Z");
        List<Instant> eleven = IntStream.range(0, 11)
                .mapToObj(i -> first.plus(Duration.ofMinutes(30L * i)))
                .toList();

        ListMenu menu = (ListMenu) BotReplies.times(day, eleven, tashkent);
        assertThat(menu.body()).isEqualTo("Вторник, 3 ноября. Выберите время.");
        assertThat(menu.buttonLabel()).isEqualTo("Выбрать время");
        assertThat(menu.rows()).hasSize(10);
        assertThat(menu.rows().get(0)).isEqualTo(new Row("time:2026-11-03T05:00:00Z", "10:00", null));
        assertThat(menu.rows().get(7)).isEqualTo(new Row("time:2026-11-03T08:30:00Z", "13:30", null));
        assertThat(menu.rows().get(8))
                .isEqualTo(new Row("more_times:2026-11-03T08:30:00Z", "Позже", "Ещё время в этот день"));
        assertThat(menu.rows().get(9)).isEqualTo(new Row("other_day", "Другой день", null));

        ListMenu eightMenu = (ListMenu) BotReplies.times(day, eleven.subList(0, 8), tashkent);
        assertThat(eightMenu.rows()).hasSize(9);
        assertThat(eightMenu.rows().get(7)).isEqualTo(new Row("time:2026-11-03T08:30:00Z", "13:30", null));
        assertThat(eightMenu.rows().get(8)).isEqualTo(new Row("other_day", "Другой день", null));

        assertThatThrownBy(() -> BotReplies.times(day, List.of(), tashkent))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BotReplies.times(day, List.of(first, first), tashkent))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void replyIdParsersAcceptOnlyCanonicalValuesWithoutThrowing() {
        UUID id = UUID.fromString("00000000-0000-0000-0000-000000000001");
        LocalDate day = LocalDate.of(2026, 11, 3);
        Instant start = Instant.parse("2026-11-03T05:00:00Z");

        assertThat(BotReplies.serviceIdOf("service:" + id)).contains(id);
        assertThat(BotReplies.moreServicesOffsetOf("more_services:0")).contains(0);
        assertThat(BotReplies.moreServicesOffsetOf("more_services:9")).contains(9);
        assertThat(BotReplies.dayOf("day:" + day)).contains(day);
        assertThat(BotReplies.timeOf("time:" + start)).contains(start);
        assertThat(BotReplies.moreTimesAfterOf("more_times:" + start)).contains(start);

        for (String invalid : List.of(
                "",
                "book",
                "day:2026-1-3",
                "day:2026-02-30",
                "time:2026-11-03T05:00Z",
                "more_times:2026-11-03T05:00Z",
                "service:1-1-1-1-1",
                "more_services:-1",
                "more_services:07",
                "more_services:+7")) {
            assertThat(BotReplies.serviceIdOf(invalid)).isEmpty();
            assertThat(BotReplies.moreServicesOffsetOf(invalid)).isEmpty();
            assertThat(BotReplies.dayOf(invalid)).isEmpty();
            assertThat(BotReplies.timeOf(invalid)).isEmpty();
            assertThat(BotReplies.moreTimesAfterOf(invalid)).isEmpty();
        }
        assertThat(BotReplies.serviceIdOf(null)).isEmpty();
        assertThat(BotReplies.moreServicesOffsetOf(null)).isEmpty();
        assertThat(BotReplies.dayOf(null)).isEmpty();
        assertThat(BotReplies.timeOf(null)).isEmpty();
        assertThat(BotReplies.moreTimesAfterOf(null)).isEmpty();
    }
}
