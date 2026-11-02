package com.massagedesk.api.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ClassPathResource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Checks the row level security policies of the Supabase migrations on a database shaped like Supabase.
 *
 * <p>It uses its own container (same image as the shared one) and no Spring context, so the shared
 * cached context and the shared database never get the Supabase objects. {@code supabase/stub.sql}
 * recreates only what the migrations and policies use: the roles {@code anon}, {@code authenticated},
 * {@code service_role}, the {@code auth} schema with {@code auth.uid()}, the realtime publication and
 * a plain (not super, not bypassrls) owner role that runs Flyway like the API's user does. Table
 * privileges are granted to the API roles as Supabase does, so a refused write comes from row level
 * security and not from a missing grant.
 *
 * <p>A request is simulated as PostgREST does it: {@code set local role}, the user id in
 * {@code request.jwt.claim.sub}, and a transaction that is always rolled back.
 *
 * <p>It does not prove: JWT verification and role switching by PostgREST, the exact grants and role
 * attributes of a real Supabase project, Realtime's own checks, or which role the API logs in with
 * on Supabase dev and prod.
 */
@Testcontainers
class SupabasePoliciesTests {

	private static final Set<String> ROLES = Set.of("authenticated", "anon");

	private static final UUID STAFF = UUID.fromString("00000000-0000-0000-0000-00000000000a");
	private static final UUID STAFF_2 = UUID.fromString("00000000-0000-0000-0000-00000000000b");
	private static final UUID STRANGER = UUID.fromString("00000000-0000-0000-0000-00000000000c");

	@Container
	static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"))
			.withTmpFs(Map.of("/var/lib/postgresql/data", "rw"));

	@FunctionalInterface
	interface SqlWork<T> {
		T run(Connection connection) throws SQLException;
	}

	@BeforeAll
	static void prepareDatabase() throws Exception {
		try (Connection connection = superuser(); Statement statement = connection.createStatement()) {
			String script = new ClassPathResource("supabase/stub.sql").getContentAsString(StandardCharsets.UTF_8);
			statement.execute(script);
		}
		Flyway.configure()
				.dataSource(POSTGRES.getJdbcUrl(), "api_owner", "api_owner")
				.locations("classpath:db/migration", "classpath:db/migration-supabase")
				.load()
				.migrate();
		seed();
	}

	private static void seed() throws SQLException, IOException {
		try (Connection connection = superuser(); Statement statement = connection.createStatement()) {
			statement.execute("insert into auth.users (id) values ('%s'), ('%s'), ('%s')"
					.formatted(STAFF, STAFF_2, STRANGER));
		}
		try (Connection connection = owner(); Statement statement = connection.createStatement()) {
			statement.execute("""
					insert into profiles (user_id, role, display_name) values
					  ('%s', 'master', 'Staff'), ('%s', 'admin', 'Staff 2');
					insert into clients (id, phone, name) values
					  ('10000000-0000-0000-0000-000000000001', '+998900000851', 'Client');
					insert into services (id, name, duration_min, price) values
					  ('20000000-0000-0000-0000-000000000001', 'Massage', 60, 100);
					insert into appointments (client_id, service_id, period) values
					  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
					   tstzrange('2030-01-01 10:00+00', '2030-01-01 11:00+00'));
					insert into conversations (id, client_id) values
					  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
					insert into messages (conversation_id, direction, author, body) values
					  ('30000000-0000-0000-0000-000000000001', 'in', 'client', 'hello');
					insert into devices (user_id, expo_push_token) values ('%s', 'token-1');
					insert into working_hours (weekday, start_time, end_time) values (1, '09:00', '18:00');
					insert into time_off (period, reason) values
					  (tstzrange('2030-02-01 00:00+00', '2030-02-02 00:00+00'), 'holiday');
					insert into events (type, entity_type, actor) values ('appointment_created', 'appointment', 'bot');
					insert into ai_runs (model, status) values ('model-1', 'ok');
					insert into webhook_logs (signature_valid) values (true);
					""".formatted(STAFF, STAFF_2, STAFF));
		}
	}

	private static Connection superuser() throws SQLException {
		return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
	}

	private static Connection owner() throws SQLException {
		return DriverManager.getConnection(POSTGRES.getJdbcUrl(), "api_owner", "api_owner");
	}

	/** Runs one simulated request as the given role (and user) and always rolls back. */
	private static <T> T as(String role, UUID sub, SqlWork<T> work) throws SQLException {
		if (!ROLES.contains(role)) {
			throw new IllegalArgumentException("unexpected role " + role);
		}
		try (Connection connection = superuser()) {
			connection.setAutoCommit(false);
			try {
				try (Statement statement = connection.createStatement()) {
					statement.execute("set local role " + role);
				}
				if (sub != null) {
					try (PreparedStatement statement = connection.prepareStatement(
							"select set_config('request.jwt.claim.sub', ?, true)")) {
						statement.setString(1, sub.toString());
						statement.execute();
					}
				}
				return work.run(connection);
			} finally {
				connection.rollback();
			}
		}
	}

	private static long count(Connection connection, String sql) throws SQLException {
		try (Statement statement = connection.createStatement(); ResultSet rows = statement.executeQuery(sql)) {
			rows.next();
			return rows.getLong(1);
		}
	}

	@Test
	void apiOwnerIsAnOrdinaryRole() throws SQLException {
		try (Connection connection = superuser();
				Statement statement = connection.createStatement();
				ResultSet rows = statement.executeQuery(
						"select rolsuper, rolbypassrls from pg_roles where rolname = 'api_owner'")) {
			assertThat(rows.next()).isTrue();
			assertThat(rows.getBoolean("rolsuper")).isFalse();
			assertThat(rows.getBoolean("rolbypassrls")).isFalse();
		}
	}

	@ParameterizedTest
	@ValueSource(strings = {"clients", "services", "working_hours", "time_off", "appointments", "conversations",
			"messages", "profiles", "devices", "settings", "events", "ai_runs", "webhook_logs"})
	void everyTableHasRowLevelSecurity(String table) throws SQLException {
		try (Connection connection = superuser();
				PreparedStatement statement = connection.prepareStatement("""
						select c.relrowsecurity, c.relforcerowsecurity, r.rolname
						from pg_class c join pg_roles r on r.oid = c.relowner
						where c.relnamespace = 'public'::regnamespace and c.relname = ?""")) {
			statement.setString(1, table);
			try (ResultSet rows = statement.executeQuery()) {
				assertThat(rows.next()).as(table).isTrue();
				assertThat(rows.getBoolean("relrowsecurity")).as(table + " rls").isTrue();
				assertThat(rows.getBoolean("relforcerowsecurity")).as(table + " forced").isFalse();
				assertThat(rows.getString("rolname")).as(table + " owner").isEqualTo("api_owner");
			}
		}
	}

	@Test
	void ownerWritesDespiteRowLevelSecurity() throws SQLException {
		try (Connection connection = owner()) {
			connection.setAutoCommit(false);
			try (Statement statement = connection.createStatement()) {
				assertThat(statement.executeUpdate("update clients set name = name")).isEqualTo(1);
				assertThat(statement.executeUpdate(
						"insert into clients (phone, name) values ('+998900000852', 'Second')")).isEqualTo(1);
			} finally {
				connection.rollback();
			}
		}
	}

	@ParameterizedTest
	@ValueSource(strings = {"clients", "services", "working_hours", "time_off", "appointments", "conversations",
			"messages", "profiles", "devices", "settings", "events", "ai_runs", "webhook_logs"})
	void staffReadsEveryTable(String table) throws SQLException {
		long rows = as("authenticated", STAFF, c -> count(c, "select count(*) from " + table));
		assertThat(rows).as(table).isGreaterThanOrEqualTo(1);
	}

	@ParameterizedTest
	@ValueSource(strings = {"clients", "services", "working_hours", "time_off", "appointments", "conversations",
			"messages", "profiles", "devices", "settings", "events", "ai_runs", "webhook_logs"})
	void nonStaffSeesNothing(String table) throws SQLException {
		long stranger = as("authenticated", STRANGER, c -> count(c, "select count(*) from " + table));
		long anonymous = as("anon", null, c -> count(c, "select count(*) from " + table));
		assertThat(stranger).as(table + " as a stranger").isZero();
		assertThat(anonymous).as(table + " as anon").isZero();
	}

	@Test
	void staffReadsOwnProfile() throws SQLException {
		long rows = as("authenticated", STAFF,
				c -> count(c, "select count(*) from profiles where user_id = '" + STAFF + "'"));
		assertThat(rows).isEqualTo(1);
	}

}
