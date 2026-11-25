package com.massagedesk.api.bot;

import com.massagedesk.api.messaging.OutboundMessage;
import java.util.List;
import java.util.Objects;

record Turn(BotSession next, List<OutboundMessage> replies) {
    Turn {
        Objects.requireNonNull(next, "next");
        replies = List.copyOf(Objects.requireNonNull(replies, "replies"));
    }
}
