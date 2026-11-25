package com.massagedesk.api.push;

import com.massagedesk.api.errors.ApiProblem;
import com.massagedesk.api.security.StaffActors;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Push notification device registration for staff phones. */
@Tag(name = "devices")
@RestController
@RequestMapping("/devices")
class DevicesController {

    private final DeviceStore store;

    DevicesController(DeviceStore store) {
        this.store = store;
    }

    @Operation(summary = "Register this phone for push notifications; repeating it is safe")
    @ApiResponse(responseCode = "200", description = "the device id; the same token always gives the same id")
    @ApiResponse(responseCode = "400", description = "missing or invalid token",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    DeviceResponse registerDevice(@Valid @RequestBody RegisterDeviceRequest request,
            @Parameter(hidden = true) Authentication authentication) {
        return new DeviceResponse(store.register(StaffActors.userId(authentication), request.expoPushToken()));
    }

    @Operation(summary = "Stop push notifications on this phone")
    @ApiResponse(responseCode = "204",
            description = "the device no longer gets notifications (also when it was not registered)")
    @ApiResponse(responseCode = "400", description = "invalid id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeDevice(@Parameter(description = "device id") @PathVariable UUID id,
            @Parameter(hidden = true) Authentication authentication) {
        store.remove(id, StaffActors.userId(authentication));
    }
}
