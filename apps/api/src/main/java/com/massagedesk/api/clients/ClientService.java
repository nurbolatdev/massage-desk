package com.massagedesk.api.clients;

import com.massagedesk.api.events.DomainEventRecorder;
import com.massagedesk.api.events.DomainEventType;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.persistence.SqlStates;
import com.massagedesk.api.settings.SettingsRepository;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates, edits, lists and searches clients. */
@Service
public class ClientService {

    private static final Pattern PHONE_CHARACTERS = Pattern.compile("^[0-9+()\\-\\s]+$");

    /** A client together with the master's time zone, safe to use outside the transaction. */
    public record ClientView(UUID id, String phone, String name, String notes, Instant createdAt, ZoneId zone) {
    }

    private final ClientRepository clients;
    private final SettingsRepository settings;
    private final DomainEventRecorder recorder;
    private final PhoneProperties phoneProperties;

    public ClientService(
            ClientRepository clients,
            SettingsRepository settings,
            DomainEventRecorder recorder,
            PhoneProperties phoneProperties) {
        this.clients = clients;
        this.settings = settings;
        this.recorder = recorder;
        this.phoneProperties = phoneProperties;
    }

    @Transactional
    public ClientView create(String rawPhone, String name, String notes, EventActor actor) {
        String phone = PhoneNumbers.normalize(rawPhone, phoneProperties.defaultRegion())
                .orElseThrow(() -> new ClientException(ClientException.Reason.INVALID_PHONE, "invalid phone number"));
        Client saved;
        try {
            saved = clients.saveAndFlush(new Client(phone, name, notes));
        } catch (DataIntegrityViolationException e) {
            if (SqlStates.has(e, SqlStates.UNIQUE_VIOLATION)) {
                throw new ClientException(
                        ClientException.Reason.PHONE_TAKEN, "client with this phone already exists", e);
            }
            throw e;
        }
        recorder.record(DomainEventType.CLIENT_CREATED, saved.getId(), actor, Map.of());
        return view(saved);
    }

    @Transactional(readOnly = true)
    public ClientView get(UUID id) {
        return view(find(id));
    }

    @Transactional
    public ClientView update(UUID id, String name, String notes) {
        Client client = find(id);
        if (name != null) {
            client.rename(name);
        }
        if (notes != null) {
            client.changeNotes(notes);
        }
        return view(clients.saveAndFlush(client));
    }

    @Transactional(readOnly = true)
    public List<ClientView> list(String q, int limit, int offset) {
        String query = q == null ? "" : q.trim();
        List<Client> found = query.isEmpty()
                ? clients.list(limit, offset)
                : clients.search(containsPattern(query), phonePattern(query), limit, offset);
        ZoneId zone = settings.get().getTimeZone();
        return found.stream().map(c -> view(c, zone)).toList();
    }

    /** {@code %q%} with the LIKE metacharacters {@code \}, {@code %} and {@code _} escaped. */
    static String containsPattern(String q) {
        String escaped = q.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    /** {@code %digits%} when q looks like a phone fragment, otherwise an empty pattern that matches nothing. */
    static String phonePattern(String q) {
        String trimmed = q.trim();
        if (!PHONE_CHARACTERS.matcher(trimmed).matches()) {
            return "";
        }
        String digits = trimmed.replaceAll("\\D", "");
        return digits.isEmpty() ? "" : "%" + digits + "%";
    }

    private Client find(UUID id) {
        return clients.findById(id)
                .orElseThrow(() -> new ClientException(ClientException.Reason.CLIENT_NOT_FOUND, "client not found"));
    }

    private ClientView view(Client client) {
        return view(client, settings.get().getTimeZone());
    }

    private static ClientView view(Client c, ZoneId zone) {
        return new ClientView(c.getId(), c.getPhone(), c.getName(), c.getNotes(), c.getCreatedAt(), zone);
    }
}
