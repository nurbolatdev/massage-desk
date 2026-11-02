package com.massagedesk.api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.security.StaffRole;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class ServicesControllerTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    private ResultActions send(MockHttpServletRequestBuilder request, StaffRole role) throws Exception {
        return mvc.perform(request.with(jwt().authorities(new SimpleGrantedAuthority(role.authority()))));
    }

    private ResultActions postService(String json, StaffRole role) throws Exception {
        return send(post("/services").contentType(MediaType.APPLICATION_JSON).content(json), role);
    }

    private ResultActions postService(String json) throws Exception {
        return postService(json, StaffRole.MASTER);
    }

    private String createId(String json) throws Exception {
        String body = postService(json).andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private ResultActions patchService(String id, String json) throws Exception {
        return send(patch("/services/" + id).contentType(MediaType.APPLICATION_JSON).content(json),
                StaffRole.MASTER);
    }

    @Test
    void createsService() throws Exception {
        postService("""
                {"name":"  Deep tissue  ","durationMin":90,"price":150000.5,"sortOrder":5000}
                """)
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Deep tissue"))
                .andExpect(jsonPath("$.durationMin").value(90))
                .andExpect(jsonPath("$.price").value(150000.5))
                .andExpect(jsonPath("$.sortOrder").value(5000))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void adminCanCreate() throws Exception {
        postService("""
                {"name":"Admin made","durationMin":30,"price":0}
                """, StaffRole.ADMIN).andExpect(status().isCreated());
    }

    @Test
    void listIncludesInactiveAndIsOrdered() throws Exception {
        String second = createId("""
                {"name":"Bravo list","durationMin":60,"price":10,"sortOrder":9001}
                """);
        String first = createId("""
                {"name":"Zulu list","durationMin":60,"price":10,"sortOrder":9000}
                """);
        String third = createId("""
                {"name":"Alpha list","durationMin":60,"price":10,"sortOrder":9001}
                """);
        patchService(second, "{\"active\":false}").andExpect(status().isOk());

        String body = send(get("/services"), StaffRole.MASTER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(second)))
                .andReturn().getResponse().getContentAsString();

        List<String> ids = JsonPath.read(body, "$[*].id");
        List<String> own = ids.stream().filter(id -> List.of(first, second, third).contains(id)).toList();
        assertThat(own).containsExactly(first, third, second);
    }

    @Test
    void deactivatedServiceHasNoSlots() throws Exception {
        String id = createId("""
                {"name":"To hide","durationMin":60,"price":10}
                """);

        patchService(id, "{\"active\":false}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        send(get("/slots").param("serviceId", id).param("day", "2026-11-03"), StaffRole.MASTER)
                .andExpect(status().isNotFound());
    }

    @Test
    void patchesEachField() throws Exception {
        String id = createId("""
                {"name":"Patch me","durationMin":60,"price":10,"sortOrder":100}
                """);

        patchService(id, """
                {"name":" Patched ","durationMin":45,"price":99.99,"sortOrder":7}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Patched"))
                .andExpect(jsonPath("$.durationMin").value(45))
                .andExpect(jsonPath("$.price").value(99.99))
                .andExpect(jsonPath("$.sortOrder").value(7))
                .andExpect(jsonPath("$.active").value(true));
        patchService(id, "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Patched"));
    }

    @Test
    void patchAcceptsANameWithALineBreakLikeCreate() throws Exception {
        String name = "{\"name\":\"Line\\nbreak\",\"durationMin\":60,\"price\":10}";
        postService(name).andExpect(status().isCreated());
        String id = createId("{\"name\":\"Plain\",\"durationMin\":60,\"price\":10}");
        patchService(id, "{\"name\":\"Line\\nbreak\"}").andExpect(status().isOk());
    }

    @Test
    void unknownServiceIsNotFound() throws Exception {
        patchService(UUID.randomUUID().toString(), "{\"active\":false}")
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("service not found"));
    }

    @Test
    void rejectsInvalidCreateFields() throws Exception {
        for (String json : List.of(
                "{\"name\":\"  \",\"durationMin\":60,\"price\":10}",
                "{\"durationMin\":60,\"price\":10}",
                "{\"name\":\"A\",\"durationMin\":4,\"price\":10}",
                "{\"name\":\"A\",\"durationMin\":481,\"price\":10}",
                "{\"name\":\"A\",\"price\":10}",
                "{\"name\":\"A\",\"durationMin\":60,\"price\":-1}",
                "{\"name\":\"A\",\"durationMin\":60,\"price\":10.123}",
                "{\"name\":\"A\",\"durationMin\":60}",
                "{\"name\":\"A\",\"durationMin\":60,\"price\":10,\"sortOrder\":-1}",
                "{\"name\":\"A\",\"durationMin\":60,\"price\":10")) {
            postService(json)
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
        }
    }

    @Test
    void rejectsInvalidPatchFields() throws Exception {
        String id = createId("""
                {"name":"Strict","durationMin":60,"price":10}
                """);

        for (String json : List.of(
                "{\"name\":\"   \"}",
                "{\"name\":\"\"}",
                "{\"durationMin\":4}",
                "{\"price\":-0.01}",
                "{\"sortOrder\":10001}",
                "{\"active\":")) {
            patchService(id, json)
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
        }
        patchService("abc", "{}").andExpect(status().isBadRequest());
    }

    @Test
    void requiresToken() throws Exception {
        mvc.perform(get("/services")).andExpect(status().isUnauthorized());
    }
}
