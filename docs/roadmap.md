# Roadmap

Vertical slices: every milestone ends with something the master can use. One task = one branch = one pull request into `develop`; commits follow Conventional Commits. 👤 marks steps only the owner can do (accounts, phone verification, payments, the pilot).

Live progress: [milestones](https://github.com/nurbolatdev/massage-desk/milestones) · [issues](https://github.com/nurbolatdev/massage-desk/issues)

## Overview

| Milestone | Result | Release | Tasks |
|---|---|---|---|
| [M0 · Foundation](#m0) | Repository, CI, database schema, API and app skeletons, docs | — | 7 |
| [M1 · Schedule](#m1) | The master runs the schedule in the app; admin panel basics; event log; deploy and APK | v0.1 | 23 |
| [M2 · Button bot](#m2) | Clients book themselves in WhatsApp with buttons; chats in the app and the admin panel | v0.2 | 6 |
| [M3 · AI assistant](#m3) | Free-text understanding, guardrails, evals, AI diagnostics | v0.3 | 6 |
| [M4 · Notifications & reports](#m4) | Push, reminders, morning summary, dashboard and reports | v0.4 | 4 |
| [M5 · Pilot → v1.0](#m5) | Two-week pilot, fixes, monitoring, system health, release | v1.0 | 4 |

## M0 · Foundation <a id="m0"></a>

Repository, CI, database schema, API and app skeletons, docs.

### M0-1 · Repository foundation

- **Branch:** `feature/infra-foundation`
- **Pull request:** `chore: repository foundation`
- **Commits:**
  1. `chore: add gitignore, editorconfig and gitattributes`
  1. `ci: add quality gate script and workflow`
  1. `chore(github): add pull request and issue templates`

### M0-2 · Spring Boot skeleton and database schema

- **Branch:** `feature/api-skeleton`
- **Pull request:** `feat(api): spring boot skeleton and database schema`
- **Depends on:** M0-1
- **Commits:**
  1. `feat(api): bootstrap spring boot 4.1 app with health endpoint`
  1. `feat(db): initial schema with supabase-only security migration`
  1. `test(db): verify the database rejects double booking`

### M0-3 · Free slot calculator

- **Branch:** `feature/api-slot-calculator`
- **Pull request:** `feat(schedule): free slot calculator`
- **Depends on:** M0-2
- **Commits:**
  1. `feat(schedule): free slot calculator`
  1. `test(schedule): working hours, breaks, bookings, notice and days off`

### M0-4 · WhatsApp webhook verification

- **Branch:** `feature/api-webhook-verify`
- **Pull request:** `feat(messaging): whatsapp webhook verification`
- **Depends on:** M0-2
- **Commits:**
  1. `feat(messaging): whatsapp webhook verification endpoint`
  1. `test(messaging): token, mode and missing parameters`

### M0-5 · Mobile app skeleton and brand

- **Branch:** `feature/mobile-skeleton`
- **Pull request:** `feat(mobile): expo app skeleton and brand`
- **Depends on:** M0-1
- **Commits:**
  1. `build: npm workspaces with a shared typescript package`
  1. `feat(mobile): expo router app with tabs, theme and today screen`
  1. `feat(brand): logo sources, generator and app icons`

### M0-6 · Documentation and roadmap

- **Branch:** `feature/docs-foundation`
- **Pull request:** `docs: readme, architecture and roadmap`
- **Depends on:** M0-2…M0-5
- **Commits:**
  1. `docs: readme with logo and contributing guide`
  1. `docs: architecture, data model, api and integrations`
  1. `docs: roadmap with tasks, commits and pull requests`

### M0-7 · Accounts: Supabase dev and prod, Expo, Meta Business 👤

Owner step, no code.

## M1 · Schedule <a id="m1"></a>

The master runs the schedule in the app; admin panel basics; event log; deploy and APK. Ends with release **v0.1**.

### M1-1 · Connect Supabase dev, seed data

- **Branch:** `feature/db-supabase-dev`
- **Pull request:** `feat(db): supabase dev project and seed data`
- **Depends on:** M0-7
- **Commits:**
  1. `feat(db): dev seed for services and working hours`
  1. `docs(db): connecting to the supabase project`
  1. `test(db): seed loads on an empty database`

### M1-2 · Event log and observability tables

- **Branch:** `feature/db-observability`
- **Pull request:** `feat(db): events, ai runs and webhook logs`
- **Depends on:** M1-1
- **Commits:**
  1. `feat(db): events, ai_runs and webhook_logs tables`
  1. `feat(api): domain event recorder`
  1. `test(api): events are written in the same transaction`

### M1-3 · Domain model and repositories

- **Branch:** `feature/api-domain-model`
- **Pull request:** `feat(api): domain model and repositories`
- **Depends on:** M0-2
- **Commits:**
  1. `feat(api): jpa entities for clients, services and schedule`
  1. `feat(api): appointment entity with time range mapping`
  1. `test(api): repositories against postgres`

### M1-4 · Authentication and roles

- **Branch:** `feature/api-security`
- **Pull request:** `feat(api): supabase jwt authentication and roles`
- **Depends on:** M1-3
- **Commits:**
  1. `feat(api): resource server with supabase jwks`
  1. `feat(api): roles from staff profiles`
  1. `test(api): 401 without token, 403 for wrong role`

### M1-5 · API contract and generated types

- **Branch:** `feature/api-contract`
- **Pull request:** `feat(api): openapi contract and typescript types`
- **Depends on:** M1-4
- **Commits:**
  1. `feat(api): openapi document with springdoc`
  1. `build: generate typescript types into packages/api-types`
  1. `ci: fail when generated types are out of date`

### M1-6 · Free slots endpoint

- **Branch:** `feature/api-slots`
- **Pull request:** `feat(schedule): free slots endpoint`
- **Depends on:** M1-3, M1-4
- **Commits:**
  1. `feat(schedule): schedule repository queries for a day`
  1. `feat(schedule): GET /slots`
  1. `test(schedule): slots endpoint with time off and bookings`

### M1-7 · Appointments API

- **Branch:** `feature/api-appointments`
- **Pull request:** `feat(booking): create, reschedule and cancel appointments`
- **Depends on:** M1-2, M1-6
- **Commits:**
  1. `feat(booking): create appointment with conflict handling`
  1. `feat(booking): reschedule, cancel and no-show`
  1. `feat(booking): record domain events`
  1. `test(booking): concurrent booking returns 409`

### M1-8 · Clients and settings API

- **Branch:** `feature/api-clients-settings`
- **Pull request:** `feat(api): clients, services and working hours`
- **Depends on:** M1-4
- **Commits:**
  1. `feat(clients): list, search and notes`
  1. `feat(settings): services, working hours and time off`
  1. `test(api): validation and role checks`

### M1-9 · Sign-in

- **Branch:** `feature/mobile-auth`
- **Pull request:** `feat(mobile): sign-in and session`
- **Depends on:** M1-4
- **Commits:**
  1. `test(mobile): jest-expo setup`
  1. `feat(mobile): supabase auth client with secure storage`
  1. `feat(mobile): design tokens, button and brand logo`
  1. `feat(mobile): text field and sign-in error messages`
  1. `feat(mobile): sign-in screen`
  1. `feat(mobile): guard routes without a session`
  1. `feat(mobile): sign out with confirmation`
  1. `docs(mobile): sign-in, session and tests`

### M1-10 · Data layer, realtime, offline

- **Branch:** `feature/mobile-data-layer`
- **Pull request:** `feat(mobile): data layer with realtime and offline cache`
- **Depends on:** M1-5, M1-9
- **Commits:**
  1. `feat(appointments): appointments of local days with names`
  1. `feat(appointments): list endpoint`
  1. `feat(mobile): api client from generated types`
  1. `feat(mobile): query cache persisted for offline`
  1. `feat(mobile): schedule queries in the master's time zone`
  1. `feat(mobile): today schedule from the api with loading and offline states`
  1. `feat(mobile): realtime updates for appointments`
  1. `test(mobile): data layer tests` (jest-expo is set up in M1-9)
  1. `docs(mobile): data layer, realtime and offline`
  1. `fix(mobile): crash-free online hook and disabled write button offline`
  1. `refactor(mobile): review cleanups for the data layer`
  1. `fix(mobile): legible disabled button on a light card`

### M1-11 · Today on real data

- **Branch:** `feature/mobile-today`
- **Pull request:** `feat(mobile): today screen on real data`
- **Depends on:** M1-10
- **Commits:**
  1. `feat(mobile): design tokens for the today screen`
  1. `feat(mobile): clock that ticks every minute and on resume`
  1. `feat(mobile): today schedule model with next client and free gaps`
  1. `feat(mobile): appointment and free-time rows from the mockups`
  1. `feat(mobile): green next-client card`
  1. `feat(mobile): today screen layout from the mockups`
  1. `feat(mobile): tomorrow summary and bot switch-on data`
  1. `feat(mobile): empty and bot-off states`
  1. `test(mobile): next client selection`
  1. `docs: today task commits in the roadmap`
  1. `fix(mobile): align today screen with the mockups`
  1. `fix(mobile): review follow-ups for the today screen`
  1. `docs: list the last today fix in the roadmap`
  1. `fix(mobile): warn when the today schedule failed to refresh`
  1. `fix(mobile): pressed state for the bot switch-on button`
  1. `docs: today screen status and deferred items in the roadmap`
  1. `fix(mobile): refresh warning only when appointments failed`

### M1-12 · Appointment card

- **Branch:** `feature/mobile-appointment`
- **Pull request:** `feat(mobile): appointment card`
- **Depends on:** M1-7, M1-11
- **Also (from M1-11):** opening the appointment card from the rows and the next-client card on Today.
- **Commits:**
  1. `feat(mobile): design tokens and danger confirm for the appointment card`
  1. `feat(mobile): appointment and client data for the card`
  1. `feat(mobile): cancel and no-show requests`
  1. `feat(mobile): appointment card texts and helpers`
  1. `feat(mobile): appointment card building blocks`
  1. `feat(mobile): appointment card screen`
  1. `feat(mobile): open the appointment card from today`
  1. `feat(mobile): client note texts and quick phrases`
  1. `feat(mobile): appointment details and notes`
  1. `feat(mobile): confirmation flow for destructive actions`
  1. `feat(mobile): cancel and no-show with confirmation`
  1. `test(mobile): destructive actions need confirmation`
  1. `docs: appointment card commits in the roadmap`
  1. `fix(mobile): fail fast offline, wait for settings, note sheet spacing`
  1. `refactor(mobile): keep sheet texts on close, use theme sizes`
  1. `fix(mobile): quick phrases match whole note parts only`
  1. `refactor(mobile): one refresh error field`
  1. `refactor(mobile): type lastAsked as AppointmentAction`
  1. `fix(mobile): no status chip for a confirmed appointment`
  1. `fix(mobile): note phrases handle line breaks and separators`
  1. `refactor(mobile): status chip helper with tests`
  1. `fix(mobile): keep line breaks when removing a note phrase`
- **Follow-up ([#66](https://github.com/nurbolatdev/massage-desk/issues/66)):**
  - **Branch:** `feature/mobile-reschedule`
  - **Pull request:** `feat(mobile): reschedule an appointment`
  - **Commits:**
    1. `feat(mobile): reschedule request and hook`
    1. `feat(mobile): reschedule texts and error kinds`
    1. `refactor(mobile): confirmation flow for any action kind`
    1. `feat(mobile): reschedule building blocks`
    1. `feat(mobile): reschedule screen`
    1. `feat(mobile): reschedule from the appointment card`
    1. `test(mobile): reschedule keeps taken time out of reach`
    1. `docs: reschedule in the roadmap and mobile guide`
    1. `fix(mobile): no flash of not found after reschedule`
    1. `fix(mobile): freeze the reschedule screen before the request`

### M1-13 · Manual booking

- **Branch:** `feature/mobile-new-appointment`
- **Pull request:** `feat(mobile): manual booking`
- **Depends on:** M1-7, M1-10, M1-11
- **Also (from M1-11):** the «Записать клиента» button on Today and the «Запись создана» confirmation with «Отменить».
- **Commits:**
  1. `feat(mobile): booking requests`
  1. `feat(mobile): booking data hooks`
  1. `feat(mobile): booking texts and day and time helpers`
  1. `feat(mobile): booking form state`
  1. `feat(mobile): client search helpers`
  1. `feat(mobile): booked notice texts and store`
  1. `feat(mobile): booking tokens, button icon and offline text`
  1. `feat(mobile): client picker with search`
  1. `feat(mobile): service step`
  1. `feat(mobile): service, day and free time steps`
  1. `feat(mobile): new appointment screen`
  1. `feat(mobile): book a client from today`
  1. `test(mobile): busy time cannot be chosen`
  1. `docs: manual booking in the roadmap and mobile guide`
  1. `fix(mobile): client search never shows an unchecked state`
  1. `fix(mobile): single submit and clean state after booking errors`
  1. `docs: align the manual booking notes with the behaviour`
  1. `refactor(mobile): name the booking skeleton height`
  1. `fix(mobile): existing client wins over the new client choice`
  1. `test(mobile): booking cache and debounce guards`
  1. `refactor(mobile): derive the booking skeleton height`
  1. `docs: manual booking commits in the roadmap`
  1. `fix(mobile): booked notice shows the client the server booked`
  1. `docs: grey disabled button in the design rules`
  1. `docs: manual booking review commits in the roadmap`
  1. `docs: limit the grey disabled rule to the primary button`
  1. `test(mobile): picked client name in the booked notice`
  1. `docs: manual booking review commits in the roadmap, part 2`

### M1-14 · Calendar

Split into four pull requests (about 1200 lines in total) and a follow-up for card depth.

**Part 1**

- **Branch:** `feature/mobile-calendar`
- **Pull request:** `feat(mobile): week calendar`
- **Depends on:** M1-11
- **Commits:**
  1. `feat(mobile): week calendar logic`
  1. `feat(mobile): week strip and calendar header`
  1. `feat(mobile): week view`
  1. `docs: week calendar in the roadmap and mobile guide`

**Part 2**

- **Branch:** `feature/mobile-calendar-month`
- **Pull request:** `feat(mobile): month calendar with day counts`
- **Issue:** #69
- **Commits:**
  1. `fix(mobile): no day summary while the week is loading`
  1. `fix(mobile): 48 dp touch area for week days`
  1. `feat(mobile): month calendar logic`
  1. `feat(mobile): segmented control`
  1. `feat(mobile): month grid and day card`
  1. `feat(mobile): month view with day counts`
  1. `docs: month calendar in the roadmap and mobile guide`

**Part 3**

- **Branch:** `feature/mobile-calendar-days-off`
- **Pull request:** `feat(mobile): days off in the calendar`
- **Issue:** #70
- **Commits:**
  1. `feat(mobile): time off query`
  1. `refactor(mobile): rename the calendar range label`
  1. `feat(mobile): days off logic for the calendar`
  1. `feat(mobile): days off in the calendar`
  1. `feat(mobile): book from the calendar day`
  1. `test(mobile): days off are shown as closed`
  1. `docs: days off in the roadmap and mobile guide`
  1. `fix(mobile): calendar days off review fixes`
  1. `refactor(mobile): calendar days off polish`

**Part 4**

- **Branch:** `feature/mobile-calendar-polish`
- **Pull request:** `feat(mobile): calendar polish`
- **Issue:** #71
- **Commits:**
  1. `fix(mobile): calendar skeleton without the heading bar`
  1. `test(mobile): unmount the calendar before going back online`
  1. `test(mobile): appointment refetch never asks without dates`
  1. `refactor(mobile): booking notice bar for the tab screens`
  1. `feat(mobile): booking notice on the calendar`
  1. `feat(mobile): calendar opens on today after another tab`
  1. `docs: calendar polish in the roadmap and mobile guide`
  1. `fix(mobile): booking notice expires while the tab is hidden`
  1. `fix(mobile): do not draw an expired booking notice`

**Part 5**

- **Branch:** `feature/mobile-depth-level-1`
- **Pull request:** `feat(mobile): level 1 depth on every card`
- **Issue:** #74
- **Commits:**
  1. `docs: level 1 depth on every mobile card`
  1. `feat(mobile): level 1 depth token and surface`
  1. `refactor(mobile): cards on the shared surface`
  1. `feat(mobile): level 1 depth on the day card and empty cards`
  1. `test(mobile): guard level 1 depth in the theme`
  1. `docs: card depth in the roadmap and mobile guide`
  1. `test(mobile): stricter depth guard`
  1. `fix(mobile): depth guard ignores comments`

### M1-15 · Days off and vacation

- **Branch:** `feature/mobile-time-off`
- **Pull request:** `feat(mobile): days off and vacation`
- **Depends on:** M1-8, M1-10
- **Commits:**
  1. `feat(mobile): mark a day off`
  1. `feat(mobile): vacation range`
  1. `test(mobile): time off form validation`

### M1-16 · Admin panel skeleton

- **Branch:** `feature/admin-skeleton`
- **Pull request:** `feat(admin): admin panel skeleton`
- **Depends on:** M1-5
- **Commits:**
  1. `chore(admin): vite react workspace with checks`
  1. `feat(admin): vite react app with brand theme`
  1. `feat(admin): base controls in brand style`
  1. `feat(admin): page states and confirm dialog`
  1. `feat(admin): supabase session with remember-me storage`
  1. `feat(admin): role check and sign-in messages`
  1. `feat(admin): typed api client with bearer token`
  1. `feat(admin): sign-in page and session`
  1. `feat(admin): staff role check on every page`
  1. `feat(admin): admin-only routes for all sections`
  1. `feat(admin): navigation for all sections`
  1. `ci: admin checks in the gate`
  1. `docs(admin): skeleton status and setup`
  1. `fix(admin): align states, buttons and phone menu with the mockups`
  1. `fix(admin): stricter design guard and session cleanup`
  1. `fix(admin): phone padding on the not-found page`
  1. `fix(admin): offline state when the session is not refreshed`

### M1-17 · Admin: schedule

- **Branch:** `feature/admin-schedule`
- **Pull request:** `feat(admin): schedule`
- **Depends on:** M1-7, M1-16
- **Commits:**
  1. `feat(api): cors for the admin origin`
  1. `feat(admin): calendar with drag-and-drop reschedule`
  1. `feat(admin): working hours editor`
  1. `test(admin): reschedule conflict is shown`
- **Also (from M1-16):** CORS allows only the admin origin from an environment variable, never "*".

### M1-18 · Admin: clients

- **Branch:** `feature/admin-clients`
- **Pull request:** `feat(admin): clients`
- **Depends on:** M1-8, M1-16
- **Commits:**
  1. `feat(admin): clients table with search`
  1. `feat(admin): client profile with visits and notes`

### M1-19 · Admin: services and settings

- **Branch:** `feature/admin-settings`
- **Pull request:** `feat(admin): services and settings`
- **Depends on:** M1-8, M1-16
- **Also (from M1-16):** the server forbids user management for master.
- **Commits:**
  1. `feat(admin): services and prices`
  1. `feat(admin): business settings and time zone`

### M1-20 · Deploy API

- **Branch:** `feature/infra-deploy`
- **Pull request:** `feat(infra): deploy api to render`
- **Depends on:** M1-7
- **Commits:**
  1. `build(api): container image`
  1. `feat(infra): render blueprint for the api`
  1. `docs(infra): production setup and secrets`

### M1-21 · Android build (APK)

- **Branch:** `feature/mobile-apk`
- **Pull request:** `feat(mobile): android build profiles`
- **Depends on:** M1-20
- **Commits:**
  1. `build(mobile): eas build profiles`
  1. `feat(mobile): over-the-air updates`
  1. `docs(mobile): installing the app on a phone`

### M1-22 · Pilot M1: a week with the master 👤

Owner step, no code.
- **Depends on:** M1-21, M1-23

### M1-23 · Breaks on Today

Today shows a break between working blocks as free time; read the working hours and show the break as a break.

- **Branch:** `feature/mobile-today-breaks`
- **Pull request:** `fix(mobile): show breaks on today`
- **Depends on:** M1-11
- **Issue:** #55
- **Commits:**
  1. `feat(mobile): working hours of the master's day`
  1. `fix(mobile): show a break instead of free time on today`
  1. `test(mobile): a break is not shown as free time`

## M2 · Button bot <a id="m2"></a>

Clients book themselves in WhatsApp with buttons; chats in the app and the admin panel. Ends with release **v0.2**.

### M2-1 · Meta app, phone number and tokens 👤

Owner step, no code.
- **Depends on:** M0-7

### M2-2 · Incoming messages webhook

- **Branch:** `feature/bot-inbound`
- **Pull request:** `feat(messaging): incoming whatsapp messages`
- **Depends on:** M2-1, M1-2
- **Commits:**
  1. `feat(messaging): signature verification`
  1. `feat(messaging): store messages and conversations`
  1. `feat(messaging): idempotency by message id`
  1. `test(messaging): duplicate deliveries are ignored`

### M2-3 · Sending messages

- **Branch:** `feature/bot-outbound`
- **Pull request:** `feat(messaging): whatsapp client`
- **Depends on:** M2-2
- **Commits:**
  1. `feat(messaging): send text, buttons and lists`
  1. `feat(messaging): 24-hour window rules`
  1. `test(messaging): template required outside the window`

### M2-4 · Booking flow with buttons

- **Branch:** `feature/bot-booking-flow`
- **Pull request:** `feat(bot): booking flow with buttons`
- **Depends on:** M2-3, M1-7
- **Commits:**
  1. `feat(bot): conversation state machine`
  1. `feat(bot): service, day and time selection`
  1. `feat(bot): confirmation, reschedule and cancel`
  1. `test(bot): full booking conversation`

### M2-5 · Chats and take-over

- **Branch:** `feature/mobile-chats`
- **Pull request:** `feat(mobile): chats and take-over`
- **Depends on:** M2-3, M1-11
- **Also (from M1-11):** the «… ждут вашего ответа» banner on Today and the badge on the Chats tab.
- **Commits:**
  1. `feat(api): conversations api and human mode`
  1. `feat(mobile): chat list and conversation`
  1. `feat(mobile): reply as the master`

### M2-6 · Admin: conversations and webhook diagnostics

- **Branch:** `feature/admin-conversations`
- **Pull request:** `feat(admin): conversations and webhook diagnostics`
- **Depends on:** M2-2, M1-16
- **Commits:**
  1. `feat(admin): conversations with filters`
  1. `feat(admin): message templates`
  1. `feat(admin): webhook delivery log`

## M3 · AI assistant <a id="m3"></a>

Free-text understanding, guardrails, evals, AI diagnostics. Ends with release **v0.3**.

### M3-1 · AI client and run log

- **Branch:** `feature/ai-client`
- **Pull request:** `feat(ai): model client and run log`
- **Depends on:** M1-2
- **Commits:**
  1. `feat(ai): http client configured by environment`
  1. `feat(ai): ai_runs logging with tokens, cost and latency`
  1. `test(ai): timeouts and errors are recorded`

### M3-2 · Booking tools

- **Branch:** `feature/ai-tools`
- **Pull request:** `feat(ai): booking tools`
- **Depends on:** M3-1, M2-4
- **Commits:**
  1. `feat(ai): tool definitions for services, slots and bookings`
  1. `feat(ai): tool execution through domain services`
  1. `test(ai): tools never bypass validation`

### M3-3 · Guardrails and hand-off

- **Branch:** `feature/ai-guardrails`
- **Pull request:** `feat(ai): guardrails and hand-off`
- **Depends on:** M3-2
- **Commits:**
  1. `feat(ai): confirmation before booking`
  1. `feat(ai): escalation for medical questions and complaints`
  1. `feat(ai): reply in the client's language`

### M3-4 · Evals

- **Branch:** `feature/ai-evals`
- **Pull request:** `test(ai): reference conversation evals`
- **Depends on:** M3-3
- **Commits:**
  1. `test(ai): reference conversations dataset`
  1. `test(ai): eval runner and report`
  1. `ci: evals on demand`

### M3-5 · AI + buttons

- **Branch:** `feature/bot-hybrid`
- **Pull request:** `feat(bot): ai replies with button fallback`
- **Depends on:** M3-4
- **Commits:**
  1. `feat(bot): route free text to the assistant`
  1. `feat(bot): keep time selection on buttons`
  1. `feat(bot): global assistant switch`

### M3-6 · Admin: AI diagnostics

- **Branch:** `feature/admin-ai-diagnostics`
- **Pull request:** `feat(admin): ai diagnostics`
- **Depends on:** M3-1, M1-16
- **Commits:**
  1. `feat(admin): runs list with cost and latency`
  1. `feat(admin): run details with tool calls`
  1. `feat(admin): eval results`

## M4 · Notifications & reports <a id="m4"></a>

Push, reminders, morning summary, dashboard and reports. Ends with release **v0.4**.

### M4-1 · Push notifications

- **Branch:** `feature/mobile-push`
- **Pull request:** `feat(mobile): push notifications`
- **Depends on:** M1-21
- **Commits:**
  1. `feat(api): device registration and push sender`
  1. `feat(mobile): notification permissions and channel`
  1. `feat(mobile): open the right screen from a push`

### M4-2 · Reminders

- **Branch:** `feature/bot-reminders`
- **Pull request:** `feat(bot): visit reminders`
- **Depends on:** M2-3
- **Commits:**
  1. `feat(bot): reminder scheduler`
  1. `feat(bot): approved reminder templates`
  1. `test(bot): reminders sent once`

### M4-3 · Morning summary

- **Branch:** `feature/api-morning-summary`
- **Pull request:** `feat(api): morning summary`
- **Depends on:** M4-1
- **Commits:**
  1. `feat(api): daily summary job`
  1. `feat(mobile): summary notification`

### M4-4 · Admin: dashboard and reports

- **Branch:** `feature/admin-reports`
- **Pull request:** `feat(admin): dashboard and reports`
- **Depends on:** M1-2
- **Commits:**
  1. `feat(api): statistics endpoints`
  1. `feat(admin): dashboard`
  1. `feat(admin): reports with charts`
  1. `feat(admin): csv export`

## M5 · Pilot → v1.0 <a id="m5"></a>

Two-week pilot, fixes, monitoring, system health, release. Ends with release **v1.0**.

### M5-1 · Pilot: two weeks 👤

Owner step, no code.
- **Depends on:** M3, M4

### M5-2 · Monitoring and backups

- **Branch:** `feature/infra-monitoring`
- **Pull request:** `feat(infra): monitoring, alerts and backups`
- **Depends on:** M1-20
- **Commits:**
  1. `feat(infra): error tracking`
  1. `feat(infra): webhook and health alerts`
  1. `docs(infra): backup and restore`

### M5-3 · Admin: system health

- **Branch:** `feature/admin-system`
- **Pull request:** `feat(admin): system health`
- **Depends on:** M5-2
- **Commits:**
  1. `feat(admin): health and queues`
  1. `feat(admin): audit log`

### M5-4 · Release v1.0

- **Branch:** `release/v1.0`
- **Pull request:** `chore(release): v1.0`
- **Depends on:** M5-1…M5-3
- **Commits:**
  1. `chore(release): changelog and version bump`
  1. `docs: final documentation`
