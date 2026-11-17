# Deploy

The API runs on Render as a Docker image and talks to a production Supabase project. The admin panel and the mobile app are not part of this deployment.

## Deploy

- The image is built from `apps/api/Dockerfile` (build context `apps/api`). Two stages: a JDK stage builds the layered jar, a JRE stage runs it as a non-root user. Tests are not run in the image; CI runs them before anything reaches `main`.
- `render.yaml` in the repository root is the Render Blueprint. It describes one web service, `massage-desk-api`.
- Render deploys from `main`, only after the GitHub checks of the commit pass, and only when files under `apps/api/**` change.
- The service runs with the `supabase` profile. Never add `seed` to production.
- Flyway applies pending migrations on startup. Without a reachable database the API does not start.
- Render terminates HTTPS. Its health check is `/health/readiness`: it does not include the database, so a short database outage does not restart a healthy service. The public status is `GET /health`.

## Environment variables

| Variable | Where | Value |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | blueprint | `supabase` |
| `SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE` | blueprint | `5`. The session pooler allows few connections, and during a deploy the old and the new instance run together. |
| `PORT` | set by Render | do not set |
| `DATABASE_URL` | secret | `jdbc:postgresql://<pooler-host>:5432/postgres?sslmode=require`, the **session pooler**. The direct connection is IPv6 only and Render connects over IPv4; the transaction pooler (port 6543) breaks JDBC prepared statements. |
| `DATABASE_USER` | secret | `postgres.<project-ref>` |
| `DATABASE_PASSWORD` | secret | database password |
| `SUPABASE_URL` | secret | `https://<project-ref>.supabase.co`, no trailing slash |
| `ADMIN_ORIGIN` | secret | exact origin of the admin panel, no path and no trailing slash; `http://localhost:5173` until the admin panel is hosted |
| `WHATSAPP_VERIFY_TOKEN` | secret | `openssl rand -hex 32`; entered in Meta when the webhook is set up (M2) |

Secrets live only in the service Environment on Render. They are not in git, not in the image and not in logs. Changing a value restarts the service. An empty `SUPABASE_URL` or `ADMIN_ORIGIN`, or a missing database, stops the service from starting: this is a safeguard, not a failure.

## First deploy (once)

1. Create the Supabase project `massage-desk-prod` in region Central EU (Frankfurt).
2. In **Connect**, copy the session pooler details (host, user, port 5432).
3. In Render choose New, then Blueprint, pick the repository and branch `main`, and enter the secret values from the table above.
4. Wait for the deploy, then check:
   ```bash
   curl -i https://<service>.onrender.com/health
   ```
   Expect `200` and `{"status":"UP"}`.
5. Once, in the production SQL editor, run `alter table public.flyway_schema_history enable row level security;` (see [data-model.md](data-model.md)).
6. Create the master account as described in [api.md](api.md) (add a staff member).
7. The master sets services, working hours and the time zone in the app. The dev seed is never applied to production.

## Releases and rollback

- A release is a merge into `main`.
- Migrations reach dev first and production through the deploy.
- To roll back, open Render, Deploys, and roll back to a previous deploy. Flyway migrations are not undone, so write migrations to stay backward compatible with the previous version.

## Run the image locally

The `supabase` profile needs a real Supabase project (its migrations use `auth.users`), so locally run the image without it, against plain PostgreSQL:

```bash
docker build -t massage-desk-api:local apps/api
docker network create md-local
docker run -d --name md-local-db --network md-local \
  -e POSTGRES_DB=massagedesk -e POSTGRES_USER=massagedesk -e POSTGRES_PASSWORD=massagedesk \
  postgres:17-alpine
until docker exec md-local-db pg_isready -U massagedesk; do sleep 1; done
docker run -d --name md-local-api --network md-local -p 18080:10000 -e PORT=10000 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://md-local-db:5432/massagedesk \
  -e SPRING_DATASOURCE_USERNAME=massagedesk -e SPRING_DATASOURCE_PASSWORD=massagedesk \
  massage-desk-api:local
until curl -fsS http://localhost:18080/health; do sleep 2; done
docker rm -f md-local-api md-local-db && docker network rm md-local
```

## Plan and limits

The blueprint uses the `free` plan: the service sleeps after 15 minutes without requests, the first request then takes about a minute, and memory is 512 MB. For the pilot and for the WhatsApp webhook switch `plan` in `render.yaml` to `starter`.

## Known gaps

- The image is not built in CI, so a broken Dockerfile shows up only on Render; the previous deploy keeps running.
- There are no alerts when the service goes down (monitoring is planned in M5).
