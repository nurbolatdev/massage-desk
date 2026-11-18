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

M1-16 skeleton is done. M1-17 (schedule) is in progress: the schedule page shows the week and day views (Week / Day switch; the day view includes free time, a current-time line, and a day summary), confirmed appointments can be rescheduled by dragging with a mouse or keyboard (Space, arrow keys, Enter) with a confirmation dialog and server-side conflict checks, and the selected appointment panel provides Reschedule first for confirmed appointments (opening a day picker with Today / Tomorrow / Another date and free times from the server via `GET /slots`, followed by the same confirmation dialog as drag-and-drop) along with Cancel (before the start time) and No-show (after the appointment starts) actions with confirmation dialogs (all disabled when offline). The Working hours view of the schedule page edits the weekly hours: several time ranges a day (up to four), a day-off checkbox, checks before saving, and a confirmation that lists confirmed appointments left outside the new hours (they stay booked); saving is disabled offline. M1-18 (clients) is done: the Clients page lists clients alphabetically with their phone, number of visits, last visit, next appointment and no-shows; shows the total number of clients and the new ones in the last 30 days under the title; filters the list by segment ("Все", "Постоянные", "Давно не были", "С неявками"), and the search works inside the selected segment; searches by name or phone digits as you type, and loads 50 at a time with a Show more button. Picking a client's name opens the client card next to the table: name, phone, the date they were added, and the note, which is loaded fresh from the server and saved with a Save button (disabled offline). The card also shows the number of visits, the total spent and how often the client comes, and the visit history, newest first, with the status of each appointment and a Show more button. M1-19 (settings) is done: the Settings page has two tabs. «Услуги и цены» lists all services with their length, price and whether they can be booked; hidden services stay in the list, greyed out. Services can be added and edited in a dialog (name, length in minutes, price in tenge) and hidden from booking or shown again; the bot, the master app and free times pick up the change right away. The «Адрес и часовой пояс» tab edits the address (up to 300 characters; an empty field clears it) and the time zone (a list with the UTC offset); working hours stay in Schedule. Changing the time zone always asks for confirmation, and if confirmed appointments would fall outside the working hours in the new zone, lists them and saves only after a second confirmation (the appointments stay booked). The new time zone applies to the whole admin right away; saving is disabled offline. The other sections are placeholders, filled by later milestones.

## Run locally

1. `npm install`
2. Copy `apps/admin/.env.example` to `apps/admin/.env` and fill the three variables: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. `npm run dev:admin`

The API must run with `ADMIN_ORIGIN` equal to the admin address (default `http://localhost:5173`), otherwise the browser blocks every request.

Tests: `npm test -w @massage-desk/admin`.

## Access

- Staff accounts only, no registration. The role is read from `profiles`.
- AI diagnostics and System are admin-only; the server enforces `/admin/**`.
- There is no user management in the admin or the API yet: staff accounts are created by the administrator. When it is added, it lives under `/admin/**`, so a master cannot reach it.
- «Remember on this computer» keeps the session after the browser closes; otherwise it ends with the tab.

## Design

Tokens in `apps/admin/src/styles/index.css` follow `docs/design.md`. A test blocks raw colors and off-scale sizes.

## Known gaps

- The design guard does not catch shadows (`drop-shadow-*`, `inset-shadow-*`, `text-shadow-*`), `aspect-*`, `z-N`, `opacity-N`, `duration-N`/`delay-N`, `h-px`/`w-px` or underline offsets; extend it in a separate commit.
- Schedule: the phone in the appointment panel is shown as received (no formatting); the selected week, day, and view mode are not kept in the page address; the day summary omits expected revenue and chats needing help; there are no buttons to create an appointment or close a day; drag-and-drop rescheduling works only within the visible week or day, does not send a message to the client, and does not restore keyboard focus when moved to another day; times offered in the Reschedule window treat the appointment's own current time as busy, so a small shift that overlaps it is possible only by drag-and-drop; moving does not send a message to the client; cancelling takes no reason and sends no message to the client; working hours have no date exceptions (days off and vacations by date are not editable here yet); unsaved working hours changes are lost when leaving the schedule page or reloading.
- Clients: the table has no "Пишет через" (language) column and no date the client was added (it is in the client card); history statuses do not depend on the client's gender ("Прошла", "Не пришёл"); CSV export is not done; the search text is not kept in the page address; the phone is shown as received; an unsaved note is dropped when another client is picked or the search or the filter changes.
- Settings: the service dialog has no bot description field (no such field in the API yet); the selected settings tab is not kept in the page address; unsaved address and time zone changes are lost when switching tabs or leaving the page; the time zone list offers four zones (a current zone outside the list is shown by its name); services cannot be reordered; there are no WhatsApp templates, bot or users tabs (the bot switch comes with M3-3); working hours are edited in Schedule.
