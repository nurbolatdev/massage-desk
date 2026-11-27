package com.massagedesk.api.push;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Push notification devices. One token is one phone; the last staff member to register it owns it;
 * removal is allowed only by the owner; tokens the push service reports as unregistered are
 * forgotten.
 */
@Repository
class DeviceStore {

    private final JdbcClient jdbc;

    DeviceStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    UUID register(UUID userId, String expoPushToken) {
        Objects.requireNonNull(userId, "userId");
        Objects.requireNonNull(expoPushToken, "expoPushToken");
        return jdbc.sql("""
                insert into devices (user_id, expo_push_token)
                values (:userId, :token)
                on conflict (expo_push_token) do update set
                    user_id = excluded.user_id
                returning id""")
                .param("userId", userId)
                .param("token", expoPushToken)
                .query(UUID.class)
                .single();
    }

    void remove(UUID id, UUID userId) {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(userId, "userId");
        jdbc.sql("delete from devices where id = :id and user_id = :userId")
                .param("id", id)
                .param("userId", userId)
                .update();
    }

    List<String> tokens() {
        return jdbc.sql("select expo_push_token from devices order by created_at, id")
                .query(String.class)
                .list();
    }

    int forget(Collection<String> tokens) {
        Objects.requireNonNull(tokens, "tokens");
        if (tokens.isEmpty()) {
            return 0;
        }
        return jdbc.sql("delete from devices where expo_push_token in (:tokens)")
                .param("tokens", tokens)
                .update();
    }
}
