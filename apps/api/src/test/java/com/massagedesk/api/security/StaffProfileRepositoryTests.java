package com.massagedesk.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import jakarta.persistence.EntityManager;
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
class StaffProfileRepositoryTests {

    private final StaffRoleConverter converter = new StaffRoleConverter();

    @Autowired
    private StaffProfileRepository profiles;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void savesAndReadsMasterAndAdmin() {
        UUID masterId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        profiles.saveAndFlush(new StaffProfile(masterId, StaffRole.MASTER, "Master"));
        profiles.saveAndFlush(new StaffProfile(adminId, StaffRole.ADMIN, "Admin"));
        entityManager.clear();

        StaffProfile master = profiles.findById(masterId).orElseThrow();
        StaffProfile admin = profiles.findById(adminId).orElseThrow();

        assertThat(master.getRole()).isEqualTo(StaffRole.MASTER);
        assertThat(master.getDisplayName()).isEqualTo("Master");
        assertThat(admin.getRole()).isEqualTo(StaffRole.ADMIN);
        assertThat(admin.getDisplayName()).isEqualTo("Admin");
    }

    @Test
    void storesLowercaseRoleText() {
        UUID masterId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        profiles.saveAndFlush(new StaffProfile(masterId, StaffRole.MASTER, null));
        profiles.saveAndFlush(new StaffProfile(adminId, StaffRole.ADMIN, null));

        assertThat(storedRole(masterId)).isEqualTo("master");
        assertThat(storedRole(adminId)).isEqualTo("admin");
    }

    @Test
    void readsRowInsertedWithSql() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into profiles (user_id, role, display_name) values (?, 'admin', 'Sql')", id);

        StaffProfile found = profiles.findById(id).orElseThrow();

        assertThat(found.getRole()).isEqualTo(StaffRole.ADMIN);
        assertThat(found.getDisplayName()).isEqualTo("Sql");
    }

    @Test
    void converterRoundTripsEveryRole() {
        for (StaffRole role : StaffRole.values()) {
            assertThat(converter.convertToEntityAttribute(converter.convertToDatabaseColumn(role))).isEqualTo(role);
        }
    }

    @Test
    void converterRejectsUnknownValue() {
        assertThatThrownBy(() -> converter.convertToEntityAttribute("owner"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void authorityHasRolePrefix() {
        assertThat(StaffRole.MASTER.authority()).isEqualTo("ROLE_MASTER");
        assertThat(StaffRole.ADMIN.authority()).isEqualTo("ROLE_ADMIN");
    }

    private String storedRole(UUID id) {
        return jdbc.queryForObject("select role from profiles where user_id = ?", String.class, id);
    }
}
