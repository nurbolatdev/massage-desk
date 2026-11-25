package com.massagedesk.api.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import com.massagedesk.api.security.StaffRole;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class DevicesControllerTests {

    private static final String TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void validTokenReturns200WithUuidAndStoresCallerUserId() throws Exception {
        UUID userId = insertProfile("master");

        String response = postDevice(tokenJson(TOKEN), userId, StaffRole.MASTER)
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

        UUID deviceId = UUID.fromString(JsonPath.read(response, "$.id"));
        assertThat(ownerOf(deviceId)).isEqualTo(userId);
        assertThat(deviceCount()).isEqualTo(1);
    }

    @Test
    void sameRequestAgainReturnsSameIdAndLeavesOneRow() throws Exception {
        UUID userId = insertProfile("master");

        String first = postDevice(tokenJson(TOKEN), userId, StaffRole.MASTER)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String firstId = JsonPath.read(first, "$.id");

        postDevice(tokenJson(TOKEN), userId, StaffRole.MASTER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(firstId));

        assertThat(deviceCount()).isEqualTo(1);
    }

    @Test
    void sameTokenBySecondProfileMovesUserIdAndReturnsSameId() throws Exception {
        UUID firstUser = insertProfile("master");
        UUID secondUser = insertProfile("admin");

        String first = postDevice(tokenJson(TOKEN), firstUser, StaffRole.MASTER)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        UUID deviceId = UUID.fromString(JsonPath.read(first, "$.id"));

        postDevice(tokenJson(TOKEN), secondUser, StaffRole.ADMIN)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(deviceId.toString()));

        assertThat(deviceCount()).isEqualTo(1);
        assertThat(ownerOf(deviceId)).isEqualTo(secondUser);
    }

    @Test
    void invalidPayloadsReturn400WithInvalidRequestCode() throws Exception {
        UUID userId = insertProfile("master");
        String over255 = "ExponentPushToken[" + "a".repeat(237) + "]";
        assertThat(over255.length()).isEqualTo(256);

        expectInvalidRequest(postDevice("{}", userId, StaffRole.MASTER));
        expectInvalidRequest(postDevice(tokenJson("   "), userId, StaffRole.MASTER));
        expectInvalidRequest(postDevice(tokenJson("abc"), userId, StaffRole.MASTER));
        expectInvalidRequest(postDevice(tokenJson(over255), userId, StaffRole.MASTER));
        expectInvalidRequest(postDevice("{not json", userId, StaffRole.MASTER));

        assertThat(deviceCount()).isZero();
    }

    @Test
    void deleteOwnDeviceReturns204AndRemovesRow() throws Exception {
        UUID userId = insertProfile("master");
        UUID deviceId = registerDevice(userId, StaffRole.MASTER);

        mvc.perform(delete("/devices/" + deviceId).with(as(userId, StaffRole.MASTER)))
                .andExpect(status().isNoContent());

        assertThat(deviceCount()).isZero();
    }

    @Test
    void deleteAnotherUsersDeviceReturns204AndKeepsRow() throws Exception {
        UUID ownerId = insertProfile("master");
        UUID otherId = insertProfile("admin");
        UUID deviceId = registerDevice(ownerId, StaffRole.MASTER);

        mvc.perform(delete("/devices/" + deviceId).with(as(otherId, StaffRole.ADMIN)))
                .andExpect(status().isNoContent());

        assertThat(deviceCount()).isEqualTo(1);
        assertThat(ownerOf(deviceId)).isEqualTo(ownerId);
    }

    @Test
    void deleteUnknownUuidReturns204() throws Exception {
        UUID userId = insertProfile("master");

        mvc.perform(delete("/devices/" + UUID.randomUUID()).with(as(userId, StaffRole.MASTER)))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteNonUuidReturns400() throws Exception {
        UUID userId = insertProfile("master");

        expectInvalidRequest(mvc.perform(delete("/devices/not-a-uuid").with(as(userId, StaffRole.MASTER))));
    }

    private UUID registerDevice(UUID userId, StaffRole role) throws Exception {
        String response = postDevice(tokenJson(TOKEN), userId, role)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(response, "$.id"));
    }

    private ResultActions postDevice(String json, UUID userId, StaffRole role) throws Exception {
        return mvc.perform(post("/devices")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json)
                .with(as(userId, role)));
    }

    private static void expectInvalidRequest(ResultActions result) throws Exception {
        result.andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    private static String tokenJson(String token) {
        return "{\"expoPushToken\":\"" + token + "\"}";
    }

    private static RequestPostProcessor as(UUID userId, StaffRole role) {
        return jwt().jwt(j -> j.subject(userId.toString()))
                .authorities(new SimpleGrantedAuthority(role.authority()));
    }

    private UUID insertProfile(String role) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into profiles (user_id, role, display_name) values (?, ?, 'Staff')", id, role);
        return id;
    }

    private UUID ownerOf(UUID deviceId) {
        return jdbc.queryForObject("select user_id from devices where id = ?", UUID.class, deviceId);
    }

    private int deviceCount() {
        Integer count = jdbc.queryForObject("select count(*) from devices", Integer.class);
        return count == null ? 0 : count;
    }
}
