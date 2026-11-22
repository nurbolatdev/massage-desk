package com.massagedesk.api.schema;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

/** Without the "seed" profile no development data is loaded. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
// Distinct context key so this test gets its own database and does not depend on other tests' cleanup.
@TestPropertySource(properties = "spring.application.name=default-profile-seed-tests")
class DefaultProfileSeedTests {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void servicesAndWorkingHoursStayEmpty() {
        assertThat(count("select count(*) from services")).isZero();
        assertThat(count("select count(*) from working_hours")).isZero();
    }

    @Test
    void seedIsNotRecordedInMigrationHistory() {
        assertThat(count("select count(*) from flyway_schema_history where description = 'dev seed'")).isZero();
    }

    private int count(String sql) {
        return jdbc.queryForObject(sql, Integer.class);
    }
}
