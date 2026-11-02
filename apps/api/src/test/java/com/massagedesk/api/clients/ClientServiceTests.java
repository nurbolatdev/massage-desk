package com.massagedesk.api.clients;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.massagedesk.api.TestcontainersConfiguration;
import com.massagedesk.api.clients.ClientService.ClientView;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.persistence.SqlStates;
import com.massagedesk.api.schedule.FixedClockConfiguration;
import jakarta.persistence.EntityManager;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedClockConfiguration.class})
@Transactional
class ClientServiceTests {

    @Autowired
    private ClientService service;

    @Autowired
    private ClientRepository clients;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbc;

    private ClientView create(String phone, String name) {
        return service.create(phone, name, null, EventActor.MASTER);
    }

    private List<String> phonesFound(String q) {
        return service.list(q, 200, 0).stream()
                .map(ClientView::phone)
                .filter(p -> p.startsWith("+9989000008"))
                .toList();
    }

    @Test
    void createsClientWithNormalizedPhoneAndEvent() {
        ClientView view = service.create("+998 (90) 000-08-01", "  Aziza  ", "  likes tea ", EventActor.MASTER);

        assertThat(view.phone()).isEqualTo("+998900000801");
        assertThat(view.name()).isEqualTo("Aziza");
        assertThat(view.notes()).isEqualTo("likes tea");
        assertThat(view.createdAt()).isNotNull();
        assertThat(view.zone()).isEqualTo(ZoneId.of("Asia/Tashkent"));

        entityManager.flush();
        List<Map<String, Object>> events = jdbc.queryForList(
                "select entity_type, actor, payload::text as payload from events where entity_id = ? and type = ?",
                view.id(), "client_created");
        assertThat(events).hasSize(1);
        assertThat(events.get(0))
                .containsEntry("entity_type", "client")
                .containsEntry("actor", "master")
                .containsEntry("payload", "{}");
    }

    @Test
    void blankNameAndNotesAreStoredAsNull() {
        ClientView view = service.create("+998900000801", "   ", "  ", EventActor.MASTER);

        assertThat(view.name()).isNull();
        assertThat(view.notes()).isNull();
    }

    @Test
    void invalidPhoneIsRefused() {
        assertThatThrownBy(() -> create("12345", "X"))
                .isInstanceOfSatisfying(ClientException.class, e -> {
                    assertThat(e.reason()).isEqualTo(ClientException.Reason.INVALID_PHONE);
                    assertThat(e).hasMessage("invalid phone number");
                });
        assertThat(clients.findByPhone("+12345")).isEmpty();
    }

    @Test
    void duplicatePhoneIsTaken() {
        create("+998900000802", "First");

        assertThatThrownBy(() -> create("998900000802", "Second"))
                .isInstanceOfSatisfying(ClientException.class, e -> {
                    assertThat(e.reason()).isEqualTo(ClientException.Reason.PHONE_TAKEN);
                    assertThat(e).hasMessage("client with this phone already exists");
                    assertThat(SqlStates.has(e.getCause(), SqlStates.UNIQUE_VIOLATION)).isTrue();
                });
    }

    @Test
    void updatesNameAndNotes() {
        UUID id = create("+998900000801", "Old").id();

        ClientView view = service.update(id, "  New ", " note ", EventActor.MASTER);

        assertThat(view.name()).isEqualTo("New");
        assertThat(view.notes()).isEqualTo("note");
        assertThat(service.get(id).name()).isEqualTo("New");
    }

    @Test
    void nullLeavesFieldUnchanged() {
        UUID id = service.create("+998900000801", "Name", "Notes", EventActor.MASTER).id();

        ClientView view = service.update(id, null, null, EventActor.MASTER);

        assertThat(view.name()).isEqualTo("Name");
        assertThat(view.notes()).isEqualTo("Notes");
    }

    @Test
    void blankClearsField() {
        UUID id = service.create("+998900000801", "Name", "Notes", EventActor.MASTER).id();

        ClientView view = service.update(id, "  ", "", EventActor.MASTER);

        assertThat(view.name()).isNull();
        assertThat(view.notes()).isNull();
    }

    @Test
    void unknownClient() {
        UUID id = UUID.randomUUID();

        assertThatThrownBy(() -> service.get(id))
                .isInstanceOfSatisfying(ClientException.class, e -> {
                    assertThat(e.reason()).isEqualTo(ClientException.Reason.CLIENT_NOT_FOUND);
                    assertThat(e).hasMessage("client not found");
                });
        assertThatThrownBy(() -> service.update(id, "x", null, EventActor.MASTER))
                .isInstanceOfSatisfying(ClientException.class,
                        e -> assertThat(e.reason()).isEqualTo(ClientException.Reason.CLIENT_NOT_FOUND));
    }

    @Test
    void searchesNameCaseInsensitively() {
        create("+998900000801", "Aziza");
        create("+998900000802", "Bakhtiyor");

        assertThat(phonesFound("aZiZ")).containsExactly("+998900000801");
    }

    @Test
    void searchesCyrillicNames() {
        create("+998900000801", "Айгуль Сапарова");
        create("+998900000802", "Bakhtiyor");

        assertThat(phonesFound("айг")).containsExactly("+998900000801");
        assertThat(phonesFound("АЙГУЛЬ")).containsExactly("+998900000801");
    }

    @Test
    void searchesByPhoneDigits() {
        create("+998900000803", "Carl");
        create("+998900000804", "Dina");

        assertThat(phonesFound("0000803")).containsExactly("+998900000803");
        assertThat(phonesFound("+998 90 000 08 03")).containsExactly("+998900000803");
    }

    @Test
    void queryWithLettersSearchesNamesOnly() {
        create("+998900000802", "Bob");
        create("+998900000805", "Ali 2");

        assertThat(phonesFound("Ali 2")).containsExactly("+998900000805");
        assertThat(phonesFound("Bob 2")).isEmpty();
    }

    @Test
    void likeMetacharactersAreLiteral() {
        create("+998900000801", "100% care");
        create("+998900000802", "a_b");
        create("+998900000803", "back\\slash");
        create("+998900000804", "plain");

        assertThat(phonesFound("%")).containsExactly("+998900000801");
        assertThat(phonesFound("_")).containsExactly("+998900000802");
        assertThat(phonesFound("\\")).containsExactly("+998900000803");
    }

    @Test
    void ordersByNameWithNamelessLast() {
        service.create("+998900000801", "Zoya", null, EventActor.BOT);
        service.create("+998900000802", null, null, EventActor.BOT);
        service.create("+998900000803", "anna", null, EventActor.BOT);

        assertThat(phonesFound(null))
                .containsExactly("+998900000803", "+998900000801", "+998900000802");
    }

    @Test
    void pagesResults() {
        create("+998900000801", "A");
        create("+998900000802", "B");
        create("+998900000803", "C");

        List<String> all = service.list("", 200, 0).stream().map(ClientView::phone).toList();
        int first = all.indexOf("+998900000801");

        List<String> page = service.list(null, 2, first).stream().map(ClientView::phone).toList();
        assertThat(page).containsExactly("+998900000801", "+998900000802");
        assertThat(service.list(null, 1, first + 2).get(0).phone()).isEqualTo("+998900000803");
    }

    @Test
    void containsPatternEscapesMetacharacters() {
        assertThat(ClientService.containsPattern(" a%b_c\\d ")).isEqualTo("%a\\%b\\_c\\\\d%");
    }

    @Test
    void phonePatternOnlyForPhoneLikeQueries() {
        assertThat(ClientService.phonePattern("+998 (90) 12-3")).isEqualTo("%998901 23%".replace(" ", ""));
        assertThat(ClientService.phonePattern("Ali 2")).isEmpty();
        assertThat(ClientService.phonePattern("+-")).isEmpty();
    }
}
