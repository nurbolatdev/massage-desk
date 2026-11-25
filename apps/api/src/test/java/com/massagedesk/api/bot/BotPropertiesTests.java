package com.massagedesk.api.bot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class BotPropertiesTests {

    @Test
    void acceptsZeroAndWholeMinutes() {
        assertThat(new BotProperties(Duration.ofMinutes(30)).changeCutoff())
                .isEqualTo(Duration.ofMinutes(30));
        assertThat(new BotProperties(Duration.ZERO).changeCutoff())
                .isEqualTo(Duration.ZERO);
    }

    @Test
    void rejectsNullNegativeAndFractionalMinutes() {
        assertThatThrownBy(() -> new BotProperties(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("app.bot.change-cutoff must not be negative");
        assertThatThrownBy(() -> new BotProperties(Duration.ofMinutes(-1)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("app.bot.change-cutoff must not be negative");
        assertThatThrownBy(() -> new BotProperties(Duration.ofSeconds(-1)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("app.bot.change-cutoff must not be negative");
        assertThatThrownBy(() -> new BotProperties(Duration.ofSeconds(90)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("app.bot.change-cutoff must be whole minutes");
    }
}
