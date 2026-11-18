package com.massagedesk.api.schema;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;

/** The "seed" profile fills an empty database with development data, and only once. */
@SpringBootTest
@ActiveProfiles("seed")
@Import(TestcontainersConfiguration.class)
class DevSeedTests {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DataSource dataSource;

    @Test
    void seedLoadsServicesAndWorkingHours() {
        assertThat(count("services")).isEqualTo(3);
        assertThat(count("working_hours")).isEqualTo(12);
    }

    @Test
    void runningTheSeedAgainDoesNotDuplicateRows() {
        new ResourceDatabasePopulator(new ClassPathResource("db/seed-dev/R__dev_seed.sql")).execute(dataSource);

        assertThat(count("services")).isEqualTo(3);
        assertThat(count("working_hours")).isEqualTo(12);
    }

    private int count(String table) {
        return jdbc.queryForObject("select count(*) from " + table, Integer.class);
    }
}
