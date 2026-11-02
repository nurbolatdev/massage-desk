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
| POST | `/appointments/{id}/reschedule` | ✅ M1 | Move, keeping the booked length |
| POST | `/appointments/{id}/cancel` | ✅ M1 | Cancel; frees the time |
| POST | `/appointments/{id}/no-show` | ✅ M1 | Mark a no-show after the start |
| GET | `/clients?q&limit&offset` | ✅ M1 | List and search clients |
| POST | `/clients` | ✅ M1 | Add a client; `409` when the phone exists |
| GET | `/clients/{id}` | ✅ M1 | One client |
| PATCH | `/clients/{id}` | ✅ M1 | Change name or notes |
| GET | `/services` | ✅ M1 | All services, active and inactive |
| POST | `/services` | ✅ M1 | Add a service |
| PATCH | `/services/{id}` | ✅ M1 | Change or deactivate a service |
| GET | `/working-hours` | ✅ M1 | The weekly working hours |
| PUT | `/working-hours` | ✅ M1 | Replace the whole week |
| GET/PUT | `/settings/*` | M1 | Time off |
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

### Reschedule, cancel and no-show

- `POST /appointments/{id}/reschedule` with `{"start":"2026-11-03T13:00:00+05:00"}` moves the appointment. The booked length is kept (not the current service length) and the same time rules as for creation apply. Errors: `400`, `404`, `409` (time taken), `422`.
- `POST /appointments/{id}/cancel` (no body) cancels it and frees the time. Errors: `400`, `404`, `409`.
- `POST /appointments/{id}/no-show` (no body) marks that the client did not come; allowed only once the visit has started, otherwise `409`. Errors: `400`, `404`, `409`.

All three return the updated appointment (same shape as the create response). Any action on an appointment that is not `confirmed` gives `409` with `appointment is <status>`; repeated actions are not idempotent. Errors are `application/problem+json`.

## Clients

`GET /clients` returns a JSON array of clients. `q` (at most 100 characters) filters by name (case-insensitive substring) and, when it consists only of phone characters (digits, `+`, spaces, brackets, dashes), also by phone digits. A blank `q` lists everyone. Order: by name alphabetically, clients without a name last, then by phone. Paging: `limit` 1..200 (default 50), `offset` from 0 (default 0); there is no total count.

```json
{"id":"<uuid>","phone":"+998901234567","name":"Aziza","notes":null,"createdAt":"2026-11-02T10:15:00+05:00"}
```

`POST /clients` takes `{"phone":"+998 90 123-45-67","name":"Aziza","notes":"..."}`; only `phone` is required. The phone is normalised to E.164 (digits only, 9 to 15 of them, same rule as the apps) and cannot be changed later, because chats are matched by it. Response `201`.

`PATCH /clients/{id}` takes `name` and/or `notes`. A missing or `null` field is left unchanged; a blank text clears the field. Text is trimmed.

- `400` (`application/problem+json`): invalid field, query parameter or id; `invalid phone number`.
- `404` (`application/problem+json`): `client not found`.
- `409` (`application/problem+json`): `client with this phone already exists`.

Clients cannot be deleted: appointments and chats refer to them.

## Services

`GET /services` returns every service, active and inactive, ordered by `sortOrder` then name. The booking screen filters by `active`.

```json
{"id":"<uuid>","name":"Classic","durationMin":60,"price":150000.5,"sortOrder":0,"active":true}
```

`POST /services` takes `name` (up to 100 characters), `durationMin` (5..480), `price` (not negative, up to 2 decimals) and optional `sortOrder` (0..10000; omitted means after the last one). Response `201`.

`PATCH /services/{id}` takes any of `name`, `durationMin`, `price`, `sortOrder`, `active`. A missing or `null` field is left unchanged. Inactive services can be edited and re-enabled.

There is no delete: appointments refer to services, so a service is deactivated with `active: false`. A deactivated service gives `404` on `/slots` and cannot be booked; appointments already made keep their service and their booked length, also after a duration change.

- `400` (`application/problem+json`): invalid field or id.
- `404` (`application/problem+json`): `service not found`.

## Working hours

`GET /working-hours` returns the week; `PUT /working-hours` replaces the whole week in one request and returns the stored blocks. Both use the same shape, ordered by weekday, then start.

```json
{"blocks":[{"weekday":1,"start":"09:00","end":"13:00"},{"weekday":1,"start":"14:00","end":"19:00"}]}
```

- `weekday` is the ISO number: 1 = Monday ... 7 = Sunday.
- `start` and `end` are local times `HH:mm` in the master's time zone (`00:00`..`23:59`; no seconds, no `24:00`).
- A weekday without blocks is a day off every week. `{"blocks":[]}` makes every day a day off.
- A break is a gap between two blocks of one day. Blocks of one day must neither overlap nor touch (`09:00-13:00` and `13:00-17:00` must be sent as one block `09:00-17:00`).
- The week is replaced atomically: either all blocks are stored or none. At most 50 blocks.
- The new hours apply to `/slots` and to new appointments at once. Appointments already made are not touched, also when they fall outside the new hours.

- `400` (`application/problem+json`): missing or invalid field.
- `422` (`application/problem+json`): `block must start before it ends`; `blocks of one day must not overlap or touch`.
