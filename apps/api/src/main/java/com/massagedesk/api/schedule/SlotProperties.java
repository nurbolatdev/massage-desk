package com.massagedesk.api.schedule;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of offered start times. Both values are set in {@code application.yml}.
 *
 * @param step how often a start time is offered (the grid of start times)
 * @param minNotice how long from now the earliest offered start is
 */
@ConfigurationProperties("app.slots")
public record SlotProperties(Duration step, Duration minNotice) {

    public SlotProperties {
        if (step == null || step.isZero() || step.isNegative()) {
            throw new IllegalArgumentException("app.slots.step must be positive");
        }
        if (minNotice == null || minNotice.isNegative()) {
            throw new IllegalArgumentException("app.slots.min-notice must not be negative");
        }
    }
}
