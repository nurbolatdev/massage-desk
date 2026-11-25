package com.massagedesk.api.push;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/** Registered push notification device. */
public record DeviceResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id) {
}
