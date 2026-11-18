# Architecture decisions

| # | Decision | Why |
|---|---|---|
| 1 | Official WhatsApp Cloud API only | Unofficial clients risk a ban of the master's number |
| 2 | Java 21 + Spring Boot 4.1 + Maven for the API | Strong typing, mature security, JPA and Flyway; the team's main stack |
| 3 | Expo for the Android app, APK via EAS | Fast start, push, OTA updates, iOS later |
| 4 | Vertical slices M1–M5 | Something usable after every milestone |
| 5 | Monorepo: Java API + npm workspaces for TypeScript apps | One place for code, docs and CI |
| 6 | OpenAPI contract → generated TypeScript types | The app and the admin panel cannot drift from the API |
| 7 | Flyway owns the schema; Supabase-only parts in a separate location | Same migrations locally, in tests and on Supabase |
| 8 | Exclusion constraint against double booking | Correct under concurrency, enforced by the database |
| 9 | Event log, AI runs and webhook logs from M1 | Statistics and diagnostics need history |
| 10 | Two Supabase projects (dev, prod) | Test data never mixes with real clients |
| 11 | Provider-neutral AI client over HTTP | Model and provider are configuration, not code |
| 12 | `main` / `develop` / `feature/*`, one PR per task with a report | Reviewable, revertible history |
