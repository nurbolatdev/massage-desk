package com.massagedesk.api.bot;

import static com.massagedesk.api.schedule.FixedClockConfiguration.NOW;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.bot.BotSession.Step;
import com.massagedesk.api.bot.BotSessionStore.Loaded;
import com.massagedesk.api.clients.Client;
import com.massagedesk.api.clients.ClientRepository;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class BotSessionStoreTests {

    @Autowired
    private BotSessionStore store;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void loadReturnsEmptyForUnknownConversationAndNullSessionWhenNotStarted() {
        UUID conversationId = conversation("+998900001201", false);

        assertThat(store.load(UUID.randomUUID())).isEmpty();
        assertThat(store.load(conversationId)).contains(new Loaded(false, null, null));
    }

    @Test
    void saveAndLoadRoundTripAllFieldsAndOverwriteExistingRow() {
        UUID conversationId = conversation("+998900001202", false);
        UUID serviceId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        LocalDate day = LocalDate.of(2026, 11, 5);
        Instant start = Instant.parse("2026-11-05T09:30:12.345678Z");
        Instant updatedAt = NOW.plus(Duration.ofMinutes(5));
        BotSession full = new BotSession(Step.CONFIRM, serviceId, day, start, appointmentId);

        store.save(conversationId, full, updatedAt);

        assertThat(store.load(conversationId)).contains(new Loaded(false, full, updatedAt));

        Instant later = updatedAt.plus(Duration.ofMinutes(10));
        store.save(conversationId, BotSession.menu(), later);

        assertThat(store.load(conversationId)).contains(new Loaded(false, BotSession.menu(), later));
        assertThat(countSessions(conversationId)).isEqualTo(1);
    }

    @Test
    void loadReflectsHumanModeAndCancelPickStep() {
        UUID conversationId = conversation("+998900001203", true);
        jdbc.update(
                "insert into bot_sessions (conversation_id, step, updated_at) values (?, 'cancel_pick', now())",
                conversationId);

        Loaded loaded = store.load(conversationId).orElseThrow();
        assertThat(loaded.humanMode()).isTrue();
        assertThat(loaded.session()).isEqualTo(new BotSession(Step.CANCEL_PICK, null, null, null, null));
        assertThat(loaded.updatedAt()).isNotNull();
    }

    @Test
    void checkConstraintRejectsUnknownStep() {
        UUID conversationId = conversation("+998900001204", false);

        assertThatThrownBy(() -> jdbc.update(
                "insert into bot_sessions (conversation_id, step, updated_at) values (?, 'other', now())",
                conversationId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void deletingConversationCascadesToSession() {
        UUID conversationId = conversation("+998900001205", false);
        store.save(conversationId, BotSession.menu(), NOW);
        assertThat(countSessions(conversationId)).isEqualTo(1);

        jdbc.update("delete from conversations where id = ?", conversationId);
        assertThat(countSessions(conversationId)).isZero();
    }

    @Test
    void claimResetsMatchingSessionToMenuOnceAndRejectsMismatchedOrMissingSession() {
        UUID conversationId = conversation("+998900001206", false);
        Instant updatedAt = NOW.plus(Duration.ofMinutes(5));
        Instant claimedAt = updatedAt.plus(Duration.ofMinutes(1));

        assertThat(store.claim(conversationId, Step.CANCEL_CONFIRM, updatedAt, claimedAt)).isFalse();
        assertThat(store.claim(UUID.randomUUID(), Step.CANCEL_CONFIRM, updatedAt, claimedAt)).isFalse();

        BotSession confirm = new BotSession(
                Step.CANCEL_CONFIRM,
                UUID.randomUUID(),
                LocalDate.of(2026, 11, 3),
                Instant.parse("2026-11-03T05:00:00Z"),
                UUID.randomUUID());
        store.save(conversationId, confirm, updatedAt);

        assertThat(store.claim(conversationId, Step.CONFIRM, updatedAt, claimedAt)).isFalse();
        assertThat(store.claim(
                        conversationId,
                        Step.CANCEL_CONFIRM,
                        updatedAt.plusSeconds(1),
                        claimedAt))
                .isFalse();
        assertThat(store.load(conversationId)).contains(new Loaded(false, confirm, updatedAt));

        assertThat(store.claim(conversationId, Step.CANCEL_CONFIRM, updatedAt, claimedAt)).isTrue();
        assertThat(store.load(conversationId))
                .contains(new Loaded(false, BotSession.menu(), claimedAt));

        assertThat(store.claim(conversationId, Step.CANCEL_CONFIRM, updatedAt, claimedAt.plusSeconds(5)))
                .isFalse();
        assertThat(store.load(conversationId))
                .contains(new Loaded(false, BotSession.menu(), claimedAt));
    }

    @Test
    void stepValuesMatchMigrationCheckConstraint() throws IOException {
        String sql = new ClassPathResource("db/migration/V5__bot_sessions.sql")
                .getContentAsString(StandardCharsets.UTF_8);
        List<String> inMigration = Pattern.compile("'([^']+)'")
                .matcher(sql)
                .results()
                .map(m -> m.group(1))
                .toList();

        assertThat(Arrays.stream(Step.values()).map(Step::column).toList())
                .isEqualTo(inMigration);
        assertThat(Step.of("other")).isEmpty();
        assertThat(Step.of(null)).isEmpty();
    }

    private UUID conversation(String phone, boolean humanMode) {
        Client client = clients.saveAndFlush(new Client(phone, "Bot client"));
        return jdbc.queryForObject(
                "insert into conversations (client_id, human_mode) values (?, ?) returning id",
                UUID.class,
                client.getId(),
                humanMode);
    }

    private Integer countSessions(UUID conversationId) {
        return jdbc.queryForObject(
                "select count(*) from bot_sessions where conversation_id = ?",
                Integer.class,
                conversationId);
    }
}
