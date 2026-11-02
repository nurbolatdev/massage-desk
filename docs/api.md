# API

Spring Boot, `apps/api`. The OpenAPI 3.1 document is served at `GET /v3/api-docs` (staff token required, no Swagger UI). The committed copy is `apps/api/openapi.json`, refreshed by `npm run api:openapi` (needs Docker), and `./mvnw verify` fails when it is out of date.

## Contract

`packages/api-types` exports `paths`, `components` and `operations` generated from `openapi.json`. Clients use `import type` only and never hand-write API types. After changing an endpoint, run `npm run api:types` and commit both files.

## Authentication

Every staff request sends `Authorization: Bearer <Supabase access token>`. The token is verified with the project JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), algorithms ES256 and RS256, issuer `${SUPABASE_URL}/auth/v1`, audience `authenticated`. The Supabase project must use JWT signing keys (dashboard, JWT Keys); the legacy shared secret is not supported, and with it every request gets `401`.

- Open without a token: `/health`, `/health/*`, `/webhook/whatsapp`.
- Staff is a row in `profiles` whose `user_id` equals the token `sub`; its `role` is `master` or `admin`. The role is read from the database on every request, never from token claims.
- `/admin/*` is admin only. Everything else needs `master` or `admin`; admin can do everything master can.
- `401`: token missing, invalid, expired, or issued for another audience or issuer.
- `403`: valid token, but the user is not staff or the role is not enough.

Errors from the endpoints below use RFC 9457 problem details (`application/problem+json`).

To add a staff member, create the user in Supabase Auth, then run:

```sql
insert into profiles (user_id, role, display_name) values ('<auth user id>', 'master', '<name>');
```

| Method | Path | Status | Purpose |
|---|---|---|---|
| GET | `/health` | ✅ M0 | Liveness and readiness |
| GET | `/webhook/whatsapp` | ✅ M0 | Meta webhook verification |
| POST | `/webhook/whatsapp` | M2 | Incoming messages |
| GET | `/slots?serviceId&day` | ✅ M1 | Free start times for a service on a day |
| POST | `/appointments` | ✅ M1 | Create; `409` when the time is taken |
| PATCH | `/appointments/{id}` | M1 | Reschedule, cancel, no-show |
| GET | `/clients` | M1 | List and search clients |
| GET/PUT | `/settings/*` | M1 | Services, working hours, time off |
| GET/POST | `/conversations/*` | M2 | Chats, master replies, take-over |
| POST | `/devices` | M4 | Register a push token |
| GET | `/admin/*` | M1–M5 | Statistics and diagnostics (admin only) |

## Free time

`GET /slots?serviceId=<uuid>&day=YYYY-MM-DD` returns the free start times of an active service on one day. `day` is a local date in the master's time zone.

```json
{"day":"2026-11-03","timeZone":"Asia/Tashkent","durationMin":60,"starts":["2026-11-03T10:00:00+05:00","2026-11-03T10:30:00+05:00"]}
```

Working hours (with breaks), time off and confirmed appointments are taken into account; times in the past are never offered. A day without working hours gives an empty `starts`.

- `400` (`application/problem+json`): `serviceId` or `day` is missing or invalid.
- `404` (`application/problem+json`): the service does not exist or is inactive.

Configuration: `APP_SLOTS_STEP` (grid of offered start times, default `30m`) and `APP_SLOTS_MIN_NOTICE` (how far ahead the first start is, default `0m`).

## Appointments

`POST /appointments` books a service for an existing client. The end is the start plus the service length; the client never sends it.

```json
{"clientId":"<uuid>","serviceId":"<uuid>","start":"2026-11-03T10:00:00+05:00"}
```

Response `201`:

```json
{"id":"<uuid>","clientId":"<uuid>","serviceId":"<uuid>","start":"2026-11-03T10:00:00+05:00","end":"2026-11-03T11:00:00+05:00","status":"confirmed","source":"manual"}
```

`start` must carry a UTC offset. Any minute is accepted, not only the grid of `/slots`. The time must lie inside one working block (breaks are excluded), outside time off and not in the past. Overlaps with other confirmed appointments are refused by the database, also under concurrent requests.

- `400` (`application/problem+json`): a field is missing or invalid, or `start` has no offset.
- `404` (`application/problem+json`): the client does not exist, or the service does not exist or is inactive.
- `409` (`application/problem+json`): the time is already booked.
- `422` (`application/problem+json`): the time is outside working hours, in time off or in the past.
