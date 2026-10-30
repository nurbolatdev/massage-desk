package com.massagedesk.api.settings;

import static org.assertj.core.api.Assertions.assertThat;

import com.massagedesk.api.TestcontainersConfiguration;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class SettingsRepositoryTests {

    @Autowired
    private SettingsRepository settings;

    @Test
    void returnsRowCreatedByMigration() {
        Settings row = settings.get();

        assertThat(row.getTimeZone()).isEqualTo(ZoneId.of("Asia/Tashkent"));
        assertThat(row.isBotEnabled()).isTrue();
    }
}
