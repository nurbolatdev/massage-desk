package com.massagedesk.api.openapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.security.StaffRole;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class OpenApiDocumentTests {

    private static final Path COMMITTED = Path.of("openapi.json");
    private static final String OUT_OF_DATE = "apps/api/openapi.json is out of date: "
            + "run \"npm run api:openapi\" (or \"npm run api:types\") from the repository root";

    @Autowired
    private MockMvc mockMvc;

    private String fetchDocument() throws Exception {
        String body = mockMvc.perform(get("/v3/api-docs")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return body.stripTrailing() + "\n";
    }

    @Test
    void documentMatchesCommittedFile() throws Exception {
        String live = fetchDocument();
        if ("true".equals(System.getenv("OPENAPI_UPDATE"))) {
            Files.writeString(COMMITTED, live, StandardCharsets.UTF_8);
            return;
        }
        assertThat(Files.exists(COMMITTED)).as(OUT_OF_DATE).isTrue();
        String committed = Files.readString(COMMITTED, StandardCharsets.UTF_8);
        assertThat(committed.stripTrailing() + "\n").as(OUT_OF_DATE).isEqualTo(live);
    }

    @Test
    void documentDescribesBearerAuthAndOpenWebhook() throws Exception {
        mockMvc.perform(get("/v3/api-docs")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi").value(org.hamcrest.Matchers.startsWith("3.1")))
                .andExpect(jsonPath("$.servers[0].url").value("/"))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.type").value("http"))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
                .andExpect(jsonPath("$.security[0].bearerAuth").exists())
                .andExpect(jsonPath("$.paths['/webhook/whatsapp'].get.security").isEmpty());
    }

    @Test
    void documentRequiresStaffToken() throws Exception {
        mockMvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
    }

    @Test
    void swaggerUiIsNotServed() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.ADMIN.authority()))))
                .andExpect(status().isNotFound());
    }
}
