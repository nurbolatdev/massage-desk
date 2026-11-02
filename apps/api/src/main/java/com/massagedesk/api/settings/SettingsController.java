package com.massagedesk.api.settings;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Time zone, address and the bot switch. */
@Tag(name = "settings")
@RestController
@RequestMapping("/settings")
class SettingsController {

    private final SettingsService service;

    SettingsController(SettingsService service) {
        this.service = service;
    }

    @Operation(summary = "Business settings")
    @ApiResponse(responseCode = "200", description = "current settings")
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    SettingsResponse getSettings() {
        return SettingsResponse.from(service.current());
    }

    @Operation(summary = "Change settings; absent or null fields stay unchanged")
    @ApiResponse(responseCode = "200", description = "settings after the change")
    @ApiResponse(responseCode = "400", description = "invalid field or unknown time zone",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @PatchMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    SettingsResponse updateSettings(@Valid @RequestBody UpdateSettingsRequest request) {
        try {
            return SettingsResponse.from(
                    service.update(request.timeZone(), request.address(), request.botEnabled()));
        } catch (SettingsException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        }
    }
}
