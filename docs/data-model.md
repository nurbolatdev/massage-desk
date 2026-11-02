# Data model

Source of truth: Flyway migrations in [`apps/api/src/main/resources/db`](../apps/api/src/main/resources/db).

- `migration/` — portable PostgreSQL schema (local, tests, Supabase).
- `migration-supabase/` — only with profile `supabase`: link to Supabase Auth, row level security, realtime.
- `seed-dev/` — only with profile `seed`: placeholder services and working hours (repeatable, idempotent). Never enable on prod.

## Connecting to the Supabase dev project
1. In the project dashboard open **Connect** and copy the **session pooler** connection details (port 5432).
2. Create `apps/api/.env` (git-ignored) from `apps/api/.env.example`:
   `DATABASE_URL=jdbc:postgresql://<pooler-host>:5432/postgres?sslmode=require`, `DATABASE_USER=postgres.<project-ref>`, `DATABASE_PASSWORD`, `SUPABASE_URL=https://<project-ref>.supabase.co` (no trailing slash; used to verify staff tokens, required with profile `supabase`).
3. Run from `apps/api`: `./mvnw spring-boot:run -Dspring-boot.run.profiles=supabase,seed`.
   The `supabase` profile reads `.env` and applies both migration locations; `seed` adds the dev data.
   For prod use `supabase` only.
4. Once per Supabase project, in the SQL editor, close Flyway's own table to the REST API:
   `alter table public.flyway_schema_history enable row level security;` (no policies on purpose).
   It cannot be a migration: Flyway holds a lock on that table while migrating, so the statement times out.

All timestamps are `timestamptz` (UTC); apps display them in `settings.time_zone`.

```mermaid
erDiagram
  clients ||--o{ appointments : books
  services ||--o{ appointments : "booked as"
  clients ||--|| conversations : has
  conversations ||--o{ messages : contains
  profiles ||--o{ devices : "push to"
  clients {
    uuid id
    text phone "E.164, unique"
    text name
  }
  services {
    uuid id
    text name
    int duration_min
    numeric price
  }
  appointments {
    uuid id
    tstzrange period
    text status "confirmed, cancelled, no_show, done"
    text source "bot, manual"
  }
  conversations {
    uuid id
    bool human_mode
    bool needs_attention
    timestamptz last_inbound_at
  }
  messages {
    uuid id
    text direction "in, out"
    text author "client, bot, master"
    text wa_message_id
  }
```

Also: `working_hours` (ISO weekday 1–7, several blocks per day for breaks), `time_off`, `settings` (single row), `profiles` (roles `master` / `admin`), `devices` (push tokens).

## Row level security (Supabase)
Only with profile `supabase` (`migration-supabase/`). Every policy is select-only and for the `authenticated` role:
- `staff_read` — `is_staff()`, on all business tables and the three log tables.
- `own_profile_read` — on `profiles` a staff member sees only their own row.

There are no insert/update/delete policies: an insert through the Supabase REST API fails (SQLState `42501`), an update or delete changes no rows. Every write goes through the API, which connects as the table owner and is not limited by RLS. `flyway_schema_history` is closed manually (see step 4 above).

Covered by `SupabasePoliciesTests` on a stand-in database (roles, `auth.uid()` and the realtime publication recreated by a script). It does not cover JWT verification and role switching by PostgREST, the exact grants of a real project, Realtime's own checks, or which role the API uses on Supabase dev and prod.

## Schedule constraints
- `clients_phone_e164` — phones are stored in E.164 (`+` and 9 to 15 digits).
- `time_off_period_bounded` — a time off period is a finite half-open range `[start, end)`.
- `working_hours_no_overlap` — working hour blocks of one day neither overlap nor touch.

The API validates first (400/422); the constraints guard direct writes. Covered by `ScheduleConstraintsTests`.

## No double booking
```sql
constraint appointments_no_overlap
    exclude using gist (period with &&) where (status = 'confirmed')
```
`[start, end)` ranges allow back-to-back appointments; cancelled ones free the time. Covered by `AppointmentOverlapConstraintTests`. Creating or moving an appointment first takes a transaction-scoped advisory lock, so parallel overlapping writes queue up instead of deadlocking; the constraint still decides the conflict.

## Observability (append-only)
- `events` — domain event log: `type` (e.g. `appointment_created`), `entity_type`, `entity_id`, `actor` (client, bot, master, admin, system), `payload` (jsonb object).
  `entity_id` has no foreign key: it may point to any table, and events outlive deleted rows.
- `ai_runs` — one row per AI assistant call: model, prompt version, intent, status, tokens, cost, latency, tool calls, error.
- `webhook_logs` — incoming WhatsApp webhooks: signature check, processing status, error, raw payload.

All three are indexed by `created_at`. The API writes them; on Supabase staff can only read them (RLS policy `staff_read`).
Domain events are written by `DomainEventRecorder` inside the caller's transaction (propagation `MANDATORY`).

Appointment events (entity type `appointment`, written by `AppointmentService` in the same transaction as the change; payload: ids and ISO-8601 UTC times only, no names or phones):
- `appointment_created` — `client_id`, `service_id`, `start`, `end`, `source`
- `appointment_rescheduled` — `client_id`, `service_id`, `previous_start`, `previous_end`, `start`, `end`
- `appointment_cancelled`, `appointment_no_show` — `client_id`, `service_id`, `start`, `end`

Client events (entity type `client`, written by `ClientService` in the creating transaction, payload `{}`, actor from the token role):
- `client_created`

The actor comes from the token role (`master` or `admin`); the bot will use `bot`. A refused action writes no event.
