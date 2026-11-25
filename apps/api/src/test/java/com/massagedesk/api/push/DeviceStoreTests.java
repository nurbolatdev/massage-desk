package com.massagedesk.api.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

import com.massagedesk.api.TestcontainersConfiguration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class DeviceStoreTests {

    private static final String TOKEN_A = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";
    private static final String TOKEN_B = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]";

    @Autowired
    private DeviceStore store;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void registerReturnsIdAndStoresRowWithUser() {
        UUID userId = insertProfile("master");

        UUID deviceId = store.register(userId, TOKEN_A);

        assertThat(deviceId).isNotNull();
        assertThat(ownerOf(deviceId)).isEqualTo(userId);
        assertThat(tokenOf(deviceId)).isEqualTo(TOKEN_A);
        assertThat(deviceCount()).isEqualTo(1);
    }

    @Test
    void registeringSameTokenAgainReturnsSameIdAndLeavesOneRow() {
        UUID userId = insertProfile("master");

        UUID firstId = store.register(userId, TOKEN_A);
        UUID secondId = store.register(userId, TOKEN_A);

        assertThat(secondId).isEqualTo(firstId);
        assertThat(deviceCount()).isEqualTo(1);
        assertThat(ownerOf(firstId)).isEqualTo(userId);
    }

    @Test
    void registeringSameTokenFromSecondProfileReturnsSameIdAndMovesUserId() {
        UUID firstUser = insertProfile("master");
        UUID secondUser = insertProfile("admin");

        UUID firstId = store.register(firstUser, TOKEN_A);
        UUID secondId = store.register(secondUser, TOKEN_A);

        assertThat(secondId).isEqualTo(firstId);
        assertThat(deviceCount()).isEqualTo(1);
        assertThat(ownerOf(firstId)).isEqualTo(secondUser);
    }

    @Test
    void twoTokensOfOneUserAreTwoRows() {
        UUID userId = insertProfile("master");

        UUID firstId = store.register(userId, TOKEN_A);
        UUID secondId = store.register(userId, TOKEN_B);

        assertThat(secondId).isNotEqualTo(firstId);
        assertThat(deviceCount()).isEqualTo(2);
        assertThat(ownerOf(firstId)).isEqualTo(userId);
        assertThat(ownerOf(secondId)).isEqualTo(userId);
    }

    @Test
    void removeByOwnerDeletesRow() {
        UUID userId = insertProfile("master");
        UUID deviceId = store.register(userId, TOKEN_A);

        store.remove(deviceId, userId);

        assertThat(deviceCount()).isZero();
    }

    @Test
    void removeByAnotherUserKeepsRow() {
        UUID ownerId = insertProfile("master");
        UUID otherId = insertProfile("admin");
        UUID deviceId = store.register(ownerId, TOKEN_A);

        store.remove(deviceId, otherId);

        assertThat(deviceCount()).isEqualTo(1);
        assertThat(ownerOf(deviceId)).isEqualTo(ownerId);
    }

    @Test
    void removeUnknownIdDoesNothingAndDoesNotThrow() {
        UUID userId = insertProfile("master");
        store.register(userId, TOKEN_A);

        assertThatNoException().isThrownBy(() -> store.remove(UUID.randomUUID(), userId));
        assertThat(deviceCount()).isEqualTo(1);
    }

    private UUID insertProfile(String role) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into profiles (user_id, role, display_name) values (?, ?, 'Staff')", id, role);
        return id;
    }

    private UUID ownerOf(UUID deviceId) {
        return jdbc.queryForObject("select user_id from devices where id = ?", UUID.class, deviceId);
    }

    private String tokenOf(UUID deviceId) {
        return jdbc.queryForObject("select expo_push_token from devices where id = ?", String.class, deviceId);
    }

    private int deviceCount() {
        Integer count = jdbc.queryForObject("select count(*) from devices", Integer.class);
        return count == null ? 0 : count;
    }
}
