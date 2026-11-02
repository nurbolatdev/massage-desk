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

## No double booking
```sql
constraint appointments_no_overlap
    exclude using gist (period with &&) where (status = 'confirmed')
```
`[start, end)` ranges allow back-to-back appointments; cancelled ones free the time. Covered by `AppointmentOverlapConstraintTests`.

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

The actor comes from the token role (`master` or `admin`); the bot will use `bot`. A refused action writes no event.
