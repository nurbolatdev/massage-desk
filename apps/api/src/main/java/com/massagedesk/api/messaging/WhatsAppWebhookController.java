package com.massagedesk.api.messaging;

import com.massagedesk.api.messaging.WebhookDeliveries.Rejection;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * WhatsApp Cloud API webhook.
 *
 * <p>GET — Meta verifies the endpoint: answer with {@code hub.challenge} when the token matches.
 * POST — Meta delivers messages and statuses; only requests signed with the app secret are
 * accepted and logged, others get 403 and are logged without the body.
 */
@Tag(name = "webhook")
@SecurityRequirements
@RestController
@RequestMapping("/webhook/whatsapp")
class WhatsAppWebhookController {

    static final int MAX_BODY_BYTES = 3 * 1024 * 1024;

    private final String verifyToken;
    private final String appSecret;
    private final WebhookDeliveries deliveries;

    WhatsAppWebhookController(
            @Value("${app.whatsapp.verify-token:}") String verifyToken,
            @Value("${app.whatsapp.app-secret:}") String appSecret,
            WebhookDeliveries deliveries) {
        this.verifyToken = verifyToken;
        this.appSecret = appSecret;
        this.deliveries = deliveries;
    }

    @Operation(summary = "Meta webhook verification")
    @ApiResponse(responseCode = "200", description = "challenge echoed")
    @ApiResponse(responseCode = "403", description = "wrong or missing verify token")
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

    @Operation(
            summary = "Incoming WhatsApp deliveries",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    description = "WhatsApp Cloud API webhook payload, signed by Meta",
                    content = @Content(mediaType = "application/json")))
    @ApiResponse(responseCode = "200", description = "signed delivery accepted and logged")
    @ApiResponse(responseCode = "403", description = "app secret not set, signature missing or wrong")
    @ApiResponse(responseCode = "413", description = "body larger than 3 MiB")
    @PostMapping
    ResponseEntity<Void> receive(
            @Parameter(description = "sha256=<hex HMAC-SHA256 of the raw body keyed by the app secret>")
                    @RequestHeader(name = "X-Hub-Signature-256", required = false)
                    String signature,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) InputStream body)
            throws IOException {
        if (request.getContentLengthLong() > MAX_BODY_BYTES) {
            deliveries.reject(Rejection.BODY_TOO_LARGE);
            return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE).build();
        }
        byte[] bytes = body.readNBytes(MAX_BODY_BYTES + 1);
        if (bytes.length > MAX_BODY_BYTES) {
            deliveries.reject(Rejection.BODY_TOO_LARGE);
            return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE).build();
        }
        if (appSecret.isBlank()) {
            deliveries.reject(Rejection.APP_SECRET_NOT_SET);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        if (signature == null || signature.isBlank()) {
            deliveries.reject(Rejection.MISSING_SIGNATURE);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        if (!WebhookSignature.matches(appSecret, bytes, signature)) {
            deliveries.reject(Rejection.INVALID_SIGNATURE);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        deliveries.accept(bytes);
        return ResponseEntity.ok().build();
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }
}
