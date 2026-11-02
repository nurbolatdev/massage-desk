package com.massagedesk.api.openapi;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Metadata of the OpenAPI document.
 *
 * <p>The document is served at {@code /v3/api-docs} to staff only; the committed copy is
 * {@code apps/api/openapi.json}. Every operation is protected unless it opts out with an empty
 * {@code @SecurityRequirements}, which matches deny-by-default in the security configuration.
 */
@Configuration(proxyBeanMethods = false)
class OpenApiConfig {

    static final String BEARER_AUTH = "bearerAuth";

    @Bean
    OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("massage-desk API")
                        .version("v1")
                        .description("REST API for the massage-desk app and admin panel"))
                .servers(List.of(new Server().url("/")))
                .components(new Components()
                        .addSecuritySchemes(
                                BEARER_AUTH,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH));
    }
}
