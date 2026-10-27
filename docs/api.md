# API

Spring Boot, `apps/api`. Staff endpoints require a Supabase JWT (`Authorization: Bearer …`); the OpenAPI document is published from M1.

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
| GET | `/admin/*` | M1–M5 | Statistics and diagnostics |
