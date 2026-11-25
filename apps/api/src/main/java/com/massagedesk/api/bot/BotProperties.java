package com.massagedesk.api.bot;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the booking bot. Values are set in {@code application.yml}.
 *
 * @param changeCutoff how long before an appointment starts a client can still cancel or move it through the bot; whole minutes, zero means no limit
 */
@ConfigurationProperties("app.bot")
public record BotProperties(Duration changeCutoff) {

    public BotProperties {
        if (changeCutoff == null || changeCutoff.isNegative()) {
            throw new IllegalArgumentException("app.bot.change-cutoff must not be negative");
        }
        if (!changeCutoff.equals(Duration.ofMinutes(changeCutoff.toMinutes()))) {
            throw new IllegalArgumentException("app.bot.change-cutoff must be whole minutes");
        }
    }
}
