# API

Spring Boot, `apps/api`. The OpenAPI document is published from M1.

## Authentication

Every request sends `Authorization: Bearer <Supabase access token>`. The token is verified with the project JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), algorithms ES256 and RS256, issuer `${SUPABASE_URL}/auth/v1`, audience `authenticated`. The Supabase project must use JWT signing keys (dashboard, JWT Keys); the legacy shared secret is not supported, and with it every request gets `401`.

- Open without a token: `/health`, `/health/*`, `/webhook/whatsapp`.
- Staff is a row in `profiles` whose `user_id` equals the token `sub`; its `role` is `master` or `admin`. The role is read from the database on every request, never from token claims.
- `/admin/*` is admin only. Everything else needs `master` or `admin`; admin can do everything master can.
- `401`: token missing, invalid, expired, or issued for another audience or issuer.
- `403`: valid token, but the user is not staff or the role is not enough.

To add a staff member, create the user in Supabase Auth, then run:

```sql
insert into profiles (user_id, role, display_name) values ('<auth user id>', 'master', '<name>');
```

| Method | Path | Status | Purpose |
|---|---|---|---|
| GET | `/health` | ✅ M0 | Liveness and readiness |
| GET | `/webhook/whatsapp` | ✅ M0 | Meta webhook verification |
| POST | `/webhook/whatsapp` | M2 | Incoming messages |
| GET | `/slots?serviceId&day` | M1 | Free start times for a service on a day |
| POST | `/appointments` | M1 | Create; `409` on time conflict |
| PATCH | `/appointments/{id}` | M1 | Reschedule, cancel, no-show |
| GET | `/clients` | M1 | List and search clients |
| GET/PUT | `/settings/*` | M1 | Services, working hours, time off |
| GET/POST | `/conversations/*` | M2 | Chats, master replies, take-over |
| POST | `/devices` | M4 | Register a push token |
| GET | `/admin/*` | M1–M5 | Statistics and diagnostics (admin only) |
