package com.massagedesk.api.clients;

import com.massagedesk.api.events.Changes;
import com.massagedesk.api.events.DomainEventRecorder;
import com.massagedesk.api.events.DomainEventType;
import com.massagedesk.api.events.EventActor;
import com.massagedesk.api.persistence.SqlStates;
import com.massagedesk.api.settings.SettingsRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates, edits, lists and searches clients. */
@Service
public class ClientService {

    private static final Pattern PHONE_CHARACTERS = Pattern.compile("^[0-9+()\\-\\s]+$");
    private static final Duration NEW_CLIENT_WINDOW = Duration.ofDays(30);

    /** A client together with the master's time zone, safe to use outside the transaction. */
    public record ClientView(UUID id, String phone, String name, String notes, Instant createdAt, ZoneId zone) {
    }

    /** Visit summary of a client together with the master's time zone. */
    public record ClientStatsView(
            int visits,
            BigDecimal totalSpent,
            int noShows,
            Instant lastVisitAt,
            Instant nextAppointmentAt,
            Integer visitIntervalDays,
            ZoneId zone) {
    }

    /** A client row together with visit stats for the list endpoint. */
    public record ClientListView(ClientView client, ClientStatsView stats) {
    }

    /** Total number of clients and how many were added in the last 30 days. */
    public record ClientsSummaryView(long total, long newLast30Days) {
    }

    private final ClientRepository clients;
    private final ClientDirectory directory;
    private final SettingsRepository settings;
    private final DomainEventRecorder recorder;
    private final PhoneProperties phoneProperties;
    private final Clock clock;
    private final JdbcClient jdbc;

    public ClientService(
            ClientRepository clients,
            ClientDirectory directory,
            SettingsRepository settings,
            DomainEventRecorder recorder,
            PhoneProperties phoneProperties,
            Clock clock,
            JdbcClient jdbc) {
        this.clients = clients;
        this.directory = directory;
        this.settings = settings;
        this.recorder = recorder;
        this.phoneProperties = phoneProperties;
        this.clock = clock;
        this.jdbc = jdbc;
    }

    /**
     * Returns the client with this E.164 phone, creating it with the name when absent; an existing
     * name is kept; safe under parallel calls (the unique phone decides, no exception).
     */
    @Transactional
    public UUID findOrCreate(String phone, String name, EventActor actor) {
        if (!PhoneNumbers.isE164(phone)) {
            throw new IllegalArgumentException("phone must be E.164");
        }
        Objects.requireNonNull(actor, "actor");
        String cleanedName = clean(name);
        Optional<UUID> inserted = jdbc.sql("""
                insert into clients (phone, name)
                values (:phone, cast(:name as text))
                on conflict (phone) do nothing
                returning id""")
                .param("phone", phone)
                .param("name", cleanedName)
                .query(UUID.class)
                .optional();
        if (inserted.isPresent()) {
            UUID id = inserted.get();
            recorder.record(DomainEventType.CLIENT_CREATED, id, actor, Map.of());
            return id;
        }
        return jdbc.sql("select id from clients where phone = :phone")
                .param("phone", phone)
                .query(UUID.class)
                .single();
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

    @Transactional(readOnly = true)
    public ClientStatsView stats(UUID id) {
        find(id);
        ZoneId zone = settings.get().getTimeZone();
        return statsView(directory.statsOf(id, clock.instant()), zone);
    }

    @Transactional
    public ClientView update(UUID id, String name, String notes, EventActor actor) {
        Client client = find(id);
        String oldName = client.getName();
        String oldNotes = client.getNotes();
        if (name != null) {
            client.rename(name);
        }
        if (notes != null) {
            client.changeNotes(notes);
        }
        Client saved = clients.saveAndFlush(client);
        Changes changes = new Changes()
                .personal("name", oldName, saved.getName())
                .personal("notes", oldNotes, saved.getNotes());
        if (!changes.isEmpty()) {
            recorder.record(DomainEventType.CLIENT_UPDATED, saved.getId(), actor, changes.payload());
        }
        return view(saved);
    }

    @Transactional(readOnly = true)
    public List<ClientListView> list(String q, ClientSegment segment, int limit, int offset) {
        String query = q == null ? "" : q.trim();
        String namePattern = query.isEmpty() ? null : containsPattern(query);
        String phonePattern = query.isEmpty() ? null : phonePattern(query);
        List<ClientDirectory.Row> found =
                directory.page(namePattern, phonePattern, segment, clock.instant(), limit, offset);
        ZoneId zone = settings.get().getTimeZone();
        return found.stream().map(row -> listView(row, zone)).toList();
    }

    @Transactional(readOnly = true)
    public ClientsSummaryView summary() {
        ClientDirectory.Summary s = directory.summary(clock.instant().minus(NEW_CLIENT_WINDOW));
        return new ClientsSummaryView(s.total(), s.newClients());
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

    static Integer visitIntervalDays(int visits, Instant first, Instant last) {
        if (visits < 2 || first == null || last == null) {
            return null;
        }
        long days = Math.round(Duration.between(first, last).toMinutes() / 1440.0 / (visits - 1));
        return Math.max(1, Math.toIntExact(days));
    }

    private static ClientStatsView statsView(ClientDirectory.VisitStats s, ZoneId zone) {
        return new ClientStatsView(
                s.visits(),
                s.totalSpent(),
                s.noShows(),
                s.lastVisitAt(),
                s.nextAppointmentAt(),
                visitIntervalDays(s.visits(), s.firstVisitAt(), s.lastVisitAt()),
                zone);
    }

    private static ClientListView listView(ClientDirectory.Row row, ZoneId zone) {
        ClientView client = new ClientView(
                row.id(), row.phone(), row.name(), row.notes(), row.createdAt(), zone);
        return new ClientListView(client, statsView(row.stats(), zone));
    }

    private static ClientView view(Client c, ZoneId zone) {
        return new ClientView(c.getId(), c.getPhone(), c.getName(), c.getNotes(), c.getCreatedAt(), zone);
    }

    private static String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
