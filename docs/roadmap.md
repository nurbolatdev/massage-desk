# Roadmap

Vertical slices: every milestone ends with something the master can use. One task = one branch = one pull request into `develop`; commits follow Conventional Commits. 👤 marks steps only the owner can do (accounts, phone verification, payments, the pilot).

Live progress: [milestones](https://github.com/nurbolatdev/massage-desk/milestones) · [issues](https://github.com/nurbolatdev/massage-desk/issues)

## Overview

| Milestone | Result | Release | Tasks |
|---|---|---|---|
| [M0 · Foundation](#m0) | Repository, CI, database schema, API and app skeletons, docs | — | 7 |
| [M1 · Schedule](#m1) | The master runs the schedule in the app; admin panel basics; event log; deploy and APK | v0.1 | 22 |
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
  1. `feat(mobile): supabase auth client with secure storage`
  1. `feat(mobile): sign-in screen`
  1. `feat(mobile): guard routes without a session`

### M1-10 · Data layer, realtime, offline

- **Branch:** `feature/mobile-data-layer`
- **Pull request:** `feat(mobile): data layer with realtime and offline cache`
- **Depends on:** M1-5, M1-9
- **Commits:**
  1. `feat(mobile): api client from generated types`
  1. `feat(mobile): query cache persisted for offline`
  1. `feat(mobile): realtime updates for appointments`
  1. `test(mobile): jest-expo setup and first tests`

### M1-11 · Today on real data

- **Branch:** `feature/mobile-today`
- **Pull request:** `feat(mobile): today screen on real data`
- **Depends on:** M1-10
- **Commits:**
  1. `feat(mobile): today screen from the api`
  1. `feat(mobile): empty and offline states`
  1. `test(mobile): next client selection`

### M1-12 · Appointment card

- **Branch:** `feature/mobile-appointment`
- **Pull request:** `feat(mobile): appointment card`
- **Depends on:** M1-7, M1-11
- **Commits:**
  1. `feat(mobile): appointment details and notes`
  1. `feat(mobile): cancel and no-show with confirmation`
  1. `test(mobile): destructive actions need confirmation`

### M1-13 · Manual booking

- **Branch:** `feature/mobile-new-appointment`
- **Pull request:** `feat(mobile): manual booking`
- **Depends on:** M1-7, M1-10
- **Commits:**
  1. `feat(mobile): client picker with search`
  1. `feat(mobile): service, day and free time steps`
  1. `test(mobile): busy time cannot be chosen`

### M1-14 · Calendar

- **Branch:** `feature/mobile-calendar`
- **Pull request:** `feat(mobile): week and month calendar`
- **Depends on:** M1-11
- **Commits:**
  1. `feat(mobile): week view`
  1. `feat(mobile): month view with day counts`
  1. `test(mobile): days off are shown as closed`

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
  1. `feat(admin): vite react app with brand theme`
  1. `feat(admin): sign-in and admin-only routes`
  1. `feat(admin): navigation for all sections`
  1. `ci: admin checks in the gate`

### M1-17 · Admin: schedule

- **Branch:** `feature/admin-schedule`
- **Pull request:** `feat(admin): schedule`
- **Depends on:** M1-7, M1-16
- **Commits:**
  1. `feat(admin): calendar with drag-and-drop reschedule`
  1. `feat(admin): working hours editor`
  1. `test(admin): reschedule conflict is shown`

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
- **Depends on:** M1-21

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
- **Depends on:** M2-3
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
