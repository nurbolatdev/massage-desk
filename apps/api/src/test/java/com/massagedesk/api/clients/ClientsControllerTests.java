package com.massagedesk.api.clients;

import static org.hamcrest.Matchers.endsWith;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.security.StaffRole;
import jakarta.persistence.EntityManager;
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
class ClientsControllerTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    private ResultActions send(MockHttpServletRequestBuilder request,
            StaffRole role) throws Exception {
        return mvc.perform(request.with(jwt().authorities(new SimpleGrantedAuthority(role.authority()))));
    }

    private ResultActions postClient(String json, StaffRole role) throws Exception {
        return send(post("/clients").contentType(MediaType.APPLICATION_JSON).content(json), role);
    }

    private ResultActions postClient(String json) throws Exception {
        return postClient(json, StaffRole.MASTER);
    }

    private String createId(String json) throws Exception {
        String body = postClient(json).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private ResultActions patchClient(String id, String json) throws Exception {
        return send(patch("/clients/" + id).contentType(MediaType.APPLICATION_JSON).content(json), StaffRole.MASTER);
    }

    @Test
    void createsClient() throws Exception {
        postClient("""
                {"phone":"+998 (90) 000-08-11","name":"  Aziza  "}
                """)
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.phone").value("+998900000811"))
                .andExpect(jsonPath("$.name").value("Aziza"))
                .andExpect(jsonPath("$.notes").isEmpty())
                .andExpect(jsonPath("$.createdAt").value(endsWith("+05:00")));
    }

    @Test
    void adminCreateRecordsAdminActor() throws Exception {
        String body = postClient("""
                {"phone":"+998900000812"}
                """, StaffRole.ADMIN).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");

        entityManager.flush();
        String actor = jdbc.queryForObject(
                "select actor from events where entity_id = ? and type = 'client_created'", String.class,
                UUID.fromString(id));
        assertThat(actor).isEqualTo("admin");
    }

    @Test
    void getsClient() throws Exception {
        String id = createId("""
                {"phone":"+998900000813","name":"Getter","notes":"likes tea"}
                """);

        send(get("/clients/" + id), StaffRole.MASTER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.name").value("Getter"))
                .andExpect(jsonPath("$.notes").value("likes tea"));
    }

    @Test
    void unknownClientIsNotFound() throws Exception {
        send(get("/clients/" + UUID.randomUUID()), StaffRole.MASTER)
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("client not found"));
    }

    @Test
    void invalidIdIsBadRequest() throws Exception {
        send(get("/clients/abc"), StaffRole.MASTER)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void updatingNotesKeepsName() throws Exception {
        String id = createId("""
                {"phone":"+998900000814","name":"Keeper"}
                """);

        patchClient(id, """
                {"notes":"allergic to oil"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Keeper"))
                .andExpect(jsonPath("$.notes").value("allergic to oil"));
    }

    @Test
    void blankNameClearsIt() throws Exception {
        String id = createId("""
                {"phone":"+998900000815","name":"Clearable"}
                """);

        patchClient(id, """
                {"name":"   "}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").isEmpty());
    }

    @Test
    void updateOfUnknownClientIsNotFound() throws Exception {
        patchClient(UUID.randomUUID().toString(), "{}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("client not found"));
    }

    @Test
    void listSearchesByNameAndPhone() throws Exception {
        createId("""
                {"phone":"+998900000816","name":"Zzyzx Searchable"}
                """);

        send(get("/clients").param("q", "zzyzx SEARCH"), StaffRole.MASTER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].phone").value("+998900000816"));

        send(get("/clients").param("q", "0000816"), StaffRole.MASTER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Zzyzx Searchable"));
    }

    @Test
    void listWithoutQueryIsAnArray() throws Exception {
        createId("""
                {"phone":"+998900000817","name":"Listed"}
                """);

        send(get("/clients"), StaffRole.MASTER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void invalidListParametersAreBadRequest() throws Exception {
        String longQuery = "a".repeat(101);
        for (String[] p : new String[][] {{"limit", "0"}, {"limit", "201"}, {"offset", "-1"}, {"q", longQuery}}) {
            send(get("/clients").param(p[0], p[1]), StaffRole.MASTER)
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
        }
    }

    @Test
    void missingPhoneIsBadRequest() throws Exception {
        postClient("""
                {"name":"No phone"}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void invalidPhoneIsBadRequest() throws Exception {
        postClient("""
                {"phone":"12345"}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("invalid phone number"));
    }

    @Test
    void malformedJsonIsBadRequest() throws Exception {
        postClient("{not json")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void requiresToken() throws Exception {
        mvc.perform(get("/clients")).andExpect(status().isUnauthorized());
    }

    @Test
    void duplicatePhoneIsConflict() throws Exception {
        createId("""
                {"phone":"+998900000818"}
                """);

        postClient("""
                {"phone":"998900000818"}
                """)
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("client with this phone already exists"));
    }
}
