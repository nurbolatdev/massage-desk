package com.massagedesk.api.clients;

import com.massagedesk.api.security.StaffActors;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Client list, search, creation and edits for the master's app. Rules live in the service. */
@Tag(name = "clients")
@RestController
@RequestMapping("/clients")
class ClientsController {

    private final ClientService clients;

    ClientsController(ClientService clients) {
        this.clients = clients;
    }

    @Operation(summary = "List clients or search them by name or phone")
    @ApiResponse(responseCode = "200", description = "clients, alphabetically by name")
    @ApiResponse(responseCode = "400", description = "invalid query parameter",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    List<ClientResponse> listClients(
            @Parameter(description = "name fragment or phone digits; blank lists everyone")
            @RequestParam(required = false) @Size(max = 100) String q,
            @Parameter(description = "page size, 1..200") @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit,
            @Parameter(description = "rows to skip") @RequestParam(defaultValue = "0") @Min(0) int offset) {
        return clients.list(q, limit, offset).stream().map(ClientResponse::from).toList();
    }

    @Operation(summary = "Get one client")
    @ApiResponse(responseCode = "200", description = "the client")
    @ApiResponse(responseCode = "400", description = "invalid id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "client not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    ClientResponse getClient(@Parameter(description = "client id") @PathVariable UUID id) {
        try {
            return ClientResponse.from(clients.get(id));
        } catch (ClientException e) {
            throw http(e);
        }
    }

    @Operation(summary = "Add a client")
    @ApiResponse(responseCode = "201", description = "client created")
    @ApiResponse(responseCode = "400", description = "missing or invalid field, or invalid phone number",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "a client with this phone already exists",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    ClientResponse createClient(@Valid @RequestBody CreateClientRequest request,
            @Parameter(hidden = true) Authentication authentication) {
        try {
            return ClientResponse.from(clients.create(
                    request.phone(), request.name(), request.notes(), StaffActors.of(authentication)));
        } catch (ClientException e) {
            throw http(e);
        }
    }

    @Operation(summary = "Change a client's name or notes")
    @ApiResponse(responseCode = "200", description = "client updated")
    @ApiResponse(responseCode = "400", description = "invalid field or id",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "client not found",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ProblemDetail.class)))
    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    ClientResponse updateClient(@Parameter(description = "client id") @PathVariable UUID id,
            @Valid @RequestBody UpdateClientRequest request,
            @Parameter(hidden = true) Authentication authentication) {
        try {
            return ClientResponse.from(clients.update(
                    id, request.name(), request.notes(), StaffActors.of(authentication)));
        } catch (ClientException e) {
            throw http(e);
        }
    }

    private static ResponseStatusException http(ClientException e) {
        HttpStatus status = switch (e.reason()) {
            case CLIENT_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case INVALID_PHONE -> HttpStatus.BAD_REQUEST;
            case PHONE_TAKEN -> HttpStatus.CONFLICT;
        };
        return new ResponseStatusException(status, e.getMessage(), e);
    }
}
