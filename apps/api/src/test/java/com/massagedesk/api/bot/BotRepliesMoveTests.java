package com.massagedesk.api.bot;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.bot.BotReplies.Upcoming;
import com.massagedesk.api.messaging.OutboundMessage.Button;
import com.massagedesk.api.messaging.OutboundMessage.Buttons;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BotRepliesMoveTests {

    @Test
    void moveConfirmationIncludesFullServiceNameOldAndNewLocalWhenAndActionButtons() {
        ZoneId tashkent = ZoneId.of("Asia/Tashkent");
        UUID id = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID serviceId = UUID.fromString("00000000-0000-0000-0000-000000000010");
        Instant oldStart = Instant.parse("2026-11-03T05:00:00Z");
        Instant newStart = Instant.parse("2026-11-03T07:00:00Z");
        Upcoming item = new Upcoming(id, serviceId, "Классический массаж", oldStart);

        assertThat(BotReplies.moveConfirmation(item, newStart, tashkent))
                .isEqualTo(new Buttons(
                        """
                        Перенести запись?
                        Классический массаж
                        Сейчас: Вторник, 3 ноября, 10:00
                        Новое время: Вторник, 3 ноября, 12:00""",
                        List.of(
                                new Button(
                                        "move_confirm:" + id + ":2026-11-03T07:00:00Z",
                                        "Перенести"),
                                new Button("other_time", "Другое время"))));

        String longName = "Классический расслабляющий массаж спины и шеи";
        assertThat(longName.length()).isGreaterThan(24);
        Upcoming longItem = new Upcoming(id, serviceId, longName, oldStart);
        Buttons longConfirmation = (Buttons) BotReplies.moveConfirmation(longItem, newStart, tashkent);
        assertThat(longConfirmation.body()).contains("\n" + longName + "\n");
    }
}
