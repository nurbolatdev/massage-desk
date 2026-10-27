# Data model

Source of truth: Flyway migrations in [`apps/api/src/main/resources/db`](../apps/api/src/main/resources/db).

- `migration/` — portable PostgreSQL schema (local, tests, Supabase).
- `migration-supabase/` — only with profile `supabase`: link to Supabase Auth, row level security, realtime.
- `seed-dev/` — only with profile `seed`: placeholder services and working hours (repeatable, idempotent). Never enable on prod.

## Connecting to the Supabase dev project
1. In the project dashboard open **Connect** and copy the **session pooler** connection details (port 5432).
2. Create `apps/api/.env` (git-ignored) from `apps/api/.env.example`:
   `DATABASE_URL=jdbc:postgresql://<pooler-host>:5432/postgres?sslmode=require`, `DATABASE_USER=postgres.<project-ref>`, `DATABASE_PASSWORD`, `SUPABASE_URL`.
3. Run from `apps/api`: `./mvnw spring-boot:run -Dspring-boot.run.profiles=supabase,seed`.
   The `supabase` profile reads `.env` and applies both migration locations; `seed` adds the dev data.
   For prod use `supabase` only.

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

## Planned (M1)
`events` (domain event log), `ai_runs` (model, tokens, cost, latency, tool calls, errors), `webhook_logs`.
