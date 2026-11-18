package com.massagedesk.api.settings;

import io.swagger.v3.oas.annotations.media.Schema;

/** The business settings. */
public record SettingsResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "IANA region id, e.g. Asia/Tashkent")
        String timeZone,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, types = {"string", "null"}) String address,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean botEnabled) {

    static SettingsResponse from(Settings settings) {
        return new SettingsResponse(settings.getTimeZone().getId(), settings.getAddress(), settings.isBotEnabled());
    }
}
