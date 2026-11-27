package com.massagedesk.api.push;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Sends a push notification to every registered staff phone through the Expo Push API.
 *
 * <p>Delivery is best-effort: this service never throws, removes tokens that Expo reports as
 * {@code DeviceNotRegistered}, and logs only counts and error codes (never tokens or notification
 * text). Meant to be called outside the caller's database transaction.
 */
@Service
public class PushSender {

    static final int MAX_BATCH = ExpoPushClient.MAX_BATCH_SIZE;

    private static final Logger log = LoggerFactory.getLogger(PushSender.class);

    private final DeviceStore deviceStore;
    private final ExpoPushClient client;

    PushSender(DeviceStore deviceStore, ExpoPushClient client) {
        this.deviceStore = Objects.requireNonNull(deviceStore, "deviceStore");
        this.client = Objects.requireNonNull(client, "client");
    }

    public void sendToAllDevices(PushMessage message) {
        if (message == null) {
            log.warn("push message is null");
            return;
        }
        try {
            if (!client.configured()) {
                return;
            }
        } catch (RuntimeException e) {
            log.warn("push configuration check failed: {}", e.getClass().getName());
            return;
        }

        List<String> tokens;
        try {
            tokens = deviceStore.tokens();
        } catch (RuntimeException e) {
            log.warn("push token load failed: {}", e.getClass().getName());
            return;
        }
        if (tokens.isEmpty()) {
            return;
        }

        int okCount = 0;
        int failedCount = 0;
        List<String> unregistered = new ArrayList<>();
        Map<String, Integer> failures = new TreeMap<>();

        for (int start = 0; start < tokens.size(); start += MAX_BATCH) {
            int end = Math.min(start + MAX_BATCH, tokens.size());
            List<String> batch = tokens.subList(start, end);
            List<PushTicket> tickets;
            try {
                tickets = client.send(batch, message);
            } catch (PushSendException e) {
                failedCount += batch.size();
                failures.merge("request", batch.size(), Integer::sum);
                log.warn("push batch of {} failed: {}", batch.size(), e.getMessage());
                continue;
            } catch (RuntimeException e) {
                failedCount += batch.size();
                failures.merge("request", batch.size(), Integer::sum);
                log.warn("push batch of {} failed: {}", batch.size(), e.getClass().getName());
                continue;
            }

            int limit = Math.min(batch.size(), tickets.size());
            for (int i = 0; i < limit; i++) {
                PushTicket ticket = tickets.get(i);
                if (ticket.ok()) {
                    okCount++;
                } else {
                    failedCount++;
                    failures.merge(ticket.error() == null ? "unknown" : ticket.error(), 1, Integer::sum);
                    if (ticket.deviceNotRegistered()) {
                        unregistered.add(batch.get(i));
                    }
                }
            }
        }

        int removedCount = 0;
        if (!unregistered.isEmpty()) {
            try {
                removedCount = deviceStore.forget(unregistered);
            } catch (RuntimeException e) {
                log.warn("push token removal failed: {}", e.getClass().getName());
            }
        }

        log.info("push sent: {} ok, {} failed ({}), {} devices removed", okCount, failedCount, failures, removedCount);
    }
}
