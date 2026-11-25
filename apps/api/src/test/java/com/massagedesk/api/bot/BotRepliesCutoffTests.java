package com.massagedesk.api.bot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.messaging.OutboundMessage.Text;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class BotRepliesCutoffTests {

    @Test
    void tooLateMessagesExplainCutoffAndNextStepInPlainRussian() {
        assertThat(BotReplies.tooLateToCancel(Duration.ofMinutes(30)))
                .isEqualTo(new Text(
                        "До начала записи меньше 30 минут, поэтому отменить её через бота уже нельзя. "
                                + "Если не можете прийти, напишите здесь — мастер увидит ваше сообщение и ответит."));
        assertThat(BotReplies.tooLateToMove(Duration.ofMinutes(30)))
                .isEqualTo(new Text(
                        "До начала записи меньше 30 минут, поэтому перенести её через бота уже нельзя. "
                                + "Если не успеваете, напишите здесь — мастер увидит ваше сообщение и ответит."));
        assertThat(BotReplies.tooLateToCancel(Duration.ofMinutes(21)))
                .isEqualTo(new Text(
                        "До начала записи меньше 21 минуты, поэтому отменить её через бота уже нельзя. "
                                + "Если не можете прийти, напишите здесь — мастер увидит ваше сообщение и ответит."));
    }

    @Test
    void minutesFormatsGenitiveCaseAfterLessThan() {
        assertThat(BotReplies.minutes(Duration.ofMinutes(1))).isEqualTo("1 минуты");
        assertThat(BotReplies.minutes(Duration.ofMinutes(2))).isEqualTo("2 минут");
        assertThat(BotReplies.minutes(Duration.ofMinutes(5))).isEqualTo("5 минут");
        assertThat(BotReplies.minutes(Duration.ofMinutes(11))).isEqualTo("11 минут");
        assertThat(BotReplies.minutes(Duration.ofMinutes(21))).isEqualTo("21 минуты");
        assertThat(BotReplies.minutes(Duration.ofMinutes(30))).isEqualTo("30 минут");
        assertThat(BotReplies.minutes(Duration.ofMinutes(101))).isEqualTo("101 минуты");
        assertThat(BotReplies.minutes(Duration.ofMinutes(111))).isEqualTo("111 минут");
        assertThat(BotReplies.minutes(Duration.ofMinutes(120))).isEqualTo("120 минут");
        assertThatThrownBy(() -> BotReplies.minutes(null))
                .isInstanceOf(NullPointerException.class);
    }
}
