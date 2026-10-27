package com.massagedesk.api.messaging;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * WhatsApp Cloud API webhook.
 *
 * <p>GET — Meta verifies the endpoint: answer with {@code hub.challenge} when the token matches.
 * POST (incoming messages) is added together with the bot logic.
 */
@RestController
@RequestMapping("/webhook/whatsapp")
class WhatsAppWebhookController {

    private final String verifyToken;

    WhatsAppWebhookController(@Value("${app.whatsapp.verify-token:}") String verifyToken) {
        this.verifyToken = verifyToken;
    }

    @GetMapping(produces = MediaType.TEXT_PLAIN_VALUE)
    ResponseEntity<String> verify(
            @RequestParam(name = "hub.mode", required = false) String mode,
            @RequestParam(name = "hub.verify_token", required = false) String token,
            @RequestParam(name = "hub.challenge", required = false) String challenge) {
        if (verifyToken.isBlank() || !"subscribe".equals(mode) || token == null || challenge == null
                || !constantTimeEquals(verifyToken, token)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("forbidden");
        }
        return ResponseEntity.ok(challenge);
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }
}
