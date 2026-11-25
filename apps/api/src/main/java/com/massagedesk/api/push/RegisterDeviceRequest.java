package com.massagedesk.api.push;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request to register a phone for push notifications. */
public record RegisterDeviceRequest(
        @NotBlank
        @Size(max = 255)
        @Pattern(regexp = "^Expo(nent)?PushToken\\[[^\\]\\s]{1,200}\\]$")
        @Schema(description = "Expo push token of this phone")
        String expoPushToken) {
}
