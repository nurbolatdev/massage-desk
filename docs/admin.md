# Admin panel

Web app `apps/admin` (React, Vite, TanStack Router and Query, shadcn/ui, Recharts) in the brand colors.

| Section | Contents | Milestone |
|---|---|---|
| Schedule | Calendar with drag-and-drop, working hours | M1 |
| Clients | Profiles, visits, notes | M1 |
| Settings | Services, prices, address, time zone | M1 |
| Conversations | All chats, filters, templates, webhook log | M2 |
| AI diagnostics | Runs with tool calls, tokens, cost, latency, errors; eval results | M3 |
| Dashboard & reports | Bookings, revenue, no-shows, bot share, response time, conversion, busy hours, CSV | M4 |
| System | Health, queues, errors, audit log | M5 |

## Status

M1-16 skeleton is done. The sections are placeholders, filled by M1-17…M1-19 and later milestones.

## Run locally

1. `npm install`
2. Copy `apps/admin/.env.example` to `apps/admin/.env` and fill the three variables: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. `npm run dev:admin`

Tests: `npm test -w @massage-desk/admin`.

## Access

- Staff accounts only, no registration. The role is read from `profiles`.
- AI diagnostics and System are admin-only; the server enforces `/admin/**`.
- «Remember on this computer» keeps the session after the browser closes; otherwise it ends with the tab.

## Design

Tokens in `apps/admin/src/styles/index.css` follow `docs/design.md`. A test blocks raw colors and off-scale sizes.

## Known gaps

- CORS for the admin origin is added in M1-17.
- The design guard does not catch shadows (`drop-shadow-*`, `inset-shadow-*`, `text-shadow-*`), `aspect-*`, `z-N`, `opacity-N`, `duration-N`/`delay-N`, `h-px`/`w-px` or underline offsets; extend it in a separate commit.
