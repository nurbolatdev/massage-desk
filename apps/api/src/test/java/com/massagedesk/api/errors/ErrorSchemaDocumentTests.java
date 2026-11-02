package com.massagedesk.api.errors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.security.StaffRole;
import java.lang.reflect.RecordComponent;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

/** The generated document describes every documented error with the one {@link ApiProblem} schema. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ErrorSchemaDocumentTests {

    private static final String PROBLEM_REF = "#/components/schemas/ApiProblem";
    private static final int DOCUMENTED_ERROR_RESPONSES = 37;

    @Autowired
    private MockMvc mvc;

    private Object document;

    @BeforeEach
    void fetchDocument() throws Exception {
        String json = mvc.perform(get("/v3/api-docs")
                        .with(jwt().authorities(new SimpleGrantedAuthority(StaffRole.MASTER.authority()))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        document = JsonPath.parse(json).json();
    }

    private <T> T read(String path) {
        return JsonPath.read(document, path);
    }

    @Test
    void errorCodeComponentListsEveryCodeInOrder() {
        List<String> documented = read("$.components.schemas.ErrorCode.enum");

        assertThat(documented).containsExactlyElementsOf(
                Arrays.stream(ErrorCode.values()).map(Enum::name).toList());
    }

    @Test
    void apiProblemHasExactlyTheRecordMembers() {
        Map<String, Object> properties = read("$.components.schemas.ApiProblem.properties");

        assertThat(properties.keySet()).containsExactlyInAnyOrderElementsOf(
                Arrays.stream(ApiProblem.class.getRecordComponents()).map(RecordComponent::getName).toList());
    }

    @Test
    void apiProblemRequiresCodeDetailInstanceStatusAndTitle() {
        List<String> required = read("$.components.schemas.ApiProblem.required");

        assertThat(Set.copyOf(required)).containsExactlyInAnyOrder("code", "detail", "instance", "status", "title");
    }

    @Test
    void apiProblemCodeRefersToTheErrorCodeComponent() {
        String ref = read("$.components.schemas.ApiProblem.properties.code['$ref']");

        assertThat(ref).isEqualTo("#/components/schemas/ErrorCode");
    }

    @Test
    void oldProblemSchemasAreGone() {
        Map<String, Object> schemas = read("$.components.schemas");

        assertThat(schemas).doesNotContainKeys("ProblemDetail", "ScheduleConflictProblem");
    }

    @Test
    void everyDocumentedErrorIsAnApiProblem() {
        Map<String, Map<String, Object>> paths = read("$.paths");
        List<String> others = new ArrayList<>();
        int problems = 0;

        for (var path : paths.entrySet()) {
            if (path.getKey().equals("/webhook/whatsapp")) {
                continue;
            }
            for (var operation : path.getValue().entrySet()) {
                Map<String, Map<String, Object>> responses = read(
                        "$.paths['" + path.getKey() + "']." + operation.getKey() + ".responses");
                for (var response : responses.entrySet()) {
                    if (Integer.parseInt(response.getKey()) < 400) {
                        continue;
                    }
                    String where = operation.getKey() + " " + path.getKey() + " " + response.getKey();
                    Map<String, Object> content = read("$.paths['" + path.getKey() + "']." + operation.getKey()
                            + ".responses['" + response.getKey() + "'].content");
                    if (!content.keySet().equals(Set.of("application/problem+json"))) {
                        others.add(where + " content " + content.keySet());
                        continue;
                    }
                    String ref = read("$.paths['" + path.getKey() + "']." + operation.getKey()
                            + ".responses['" + response.getKey()
                            + "'].content['application/problem+json'].schema['$ref']");
                    if (PROBLEM_REF.equals(ref)) {
                        problems++;
                    } else {
                        others.add(where + " schema " + ref);
                    }
                }
            }
        }

        assertThat(others).isEmpty();
        assertThat(problems).isEqualTo(DOCUMENTED_ERROR_RESPONSES);
    }
}
