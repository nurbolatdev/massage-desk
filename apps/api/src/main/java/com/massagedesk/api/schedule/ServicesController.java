package com.massagedesk.api.schedule;

import com.massagedesk.api.security.StaffActors;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The master's service catalog. Services are deactivated, never deleted. */
@Tag(name = "services")
@RestController
@RequestMapping("/services")
class ServicesController {

    private final ServiceCatalog catalog;

    ServicesController(ServiceCatalog catalog) {
        this.catalog = catalog;
    }

    @Operation(summary = "List all services, active and inactive")
    @ApiResponse(responseCode = "200", description = "services in display order")
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    List<ServiceResponse> listServices() {
        return catalog.all().stream().map(ServiceResponse::from).toList();
    }

    @Operation(summary = "Add a service")
    @ApiResponse(responseCode = "201", description = "service created")
    @ApiResponse(responseCode = "400", description = "missing or invalid field",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    ServiceResponse createService(@Valid @RequestBody CreateServiceRequest request,
            @Parameter(hidden = true) Authentication authentication) {
        return ServiceResponse.from(catalog.create(request.name(), request.durationMin(), request.price(),
                request.sortOrder(), StaffActors.of(authentication)));
    }

    @Operation(summary = "Change or deactivate a service")
    @ApiResponse(responseCode = "200", description = "service updated")
    @ApiResponse(responseCode = "400", description = "invalid field or id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "service not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    ServiceResponse updateService(@Parameter(description = "service id") @PathVariable UUID id,
            @Valid @RequestBody UpdateServiceRequest request,
            @Parameter(hidden = true) Authentication authentication) {
        try {
            return ServiceResponse.from(catalog.update(id, request.name(), request.durationMin(),
                    request.price(), request.sortOrder(), request.active(), StaffActors.of(authentication)));
        } catch (ScheduleException e) {
            throw ScheduleErrors.http(e);
        }
    }
}
