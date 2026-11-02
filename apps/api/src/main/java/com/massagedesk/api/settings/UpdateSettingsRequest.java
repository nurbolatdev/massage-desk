package com.massagedesk.api.settings;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/** Fields left out or null stay unchanged; a blank address clears it. */
public record UpdateSettingsRequest(
        @Size(min = 1, max = 64) @Schema(description = "IANA region id; fixed offsets are refused")
        String timeZone,
        @Size(max = 300) String address,
        Boolean botEnabled) {
}
