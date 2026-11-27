package com.massagedesk.api.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

import com.massagedesk.api.TestcontainersConfiguration;
import java.util.List;
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
    private static final String TOKEN_C = "ExponentPushToken[cccccccccccccccccccccc]";

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

    @Test
    void tokensReturnsEmptyListWhenNoDevicesExist() {
        assertThat(store.tokens()).isEmpty();
    }

    @Test
    void tokensReturnsAllTokensOfAllUsersInCreationOrder() {
        UUID masterId = insertProfile("master");
        UUID adminId = insertProfile("admin");

        UUID firstId = store.register(masterId, TOKEN_B);
        UUID secondId = store.register(adminId, TOKEN_A);
        UUID thirdId = store.register(masterId, TOKEN_C);
        jdbc.update("update devices set created_at = '2026-01-01T10:00:00Z'::timestamptz where id = ?", firstId);
        jdbc.update("update devices set created_at = '2026-01-01T10:00:01Z'::timestamptz where id = ?", secondId);
        jdbc.update("update devices set created_at = '2026-01-01T10:00:02Z'::timestamptz where id = ?", thirdId);

        assertThat(store.tokens()).containsExactly(TOKEN_B, TOKEN_A, TOKEN_C);
    }

    @Test
    void forgetDeletesGivenTokensIgnoresUnknownAndReturnsDeletedCount() {
        UUID masterId = insertProfile("master");
        UUID adminId = insertProfile("admin");
        store.register(masterId, TOKEN_A);
        store.register(adminId, TOKEN_B);
        store.register(masterId, TOKEN_C);

        int removed = store.forget(List.of(
                TOKEN_A,
                TOKEN_C,
                "ExponentPushToken[unknown-token]"));

        assertThat(removed).isEqualTo(2);
        assertThat(store.tokens()).containsExactly(TOKEN_B);
    }

    @Test
    void forgetWithEmptyCollectionReturnsZeroAndDeletesNothing() {
        UUID userId = insertProfile("master");
        store.register(userId, TOKEN_A);

        int removed = store.forget(List.of());

        assertThat(removed).isZero();
        assertThat(store.tokens()).containsExactly(TOKEN_A);
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
