# Contributing

## Branches
- `main` — releases only (tags `v0.N`), deployed to production.
- `develop` — integration branch, default.
- `feature/<area>-<name>`, `fix/<area>-<name>` — one task each. Areas: `db`, `api`, `mobile`, `admin`, `bot`, `ai`, `infra`, `docs`.

## Workflow
1. Take an issue; branch from a fresh `develop`.
2. Small commits, one logical step each, in [Conventional Commits](https://www.conventionalcommits.org/) style: `feat(booking): …`, `fix(mobile): …`, `test(schedule): …`.
3. `npm run check` must print `GATE PASS` before every commit.
4. Open a pull request into `develop` with the template (`Closes #<issue>`). CI runs the same gate.
5. Merge with a merge commit (not squash) after review.

## Rules
- **API:** Java 21, constructor injection, package by feature (`schedule`, `booking`, `messaging`, `ai`, `clients`, `admin`). Schema changes only through Flyway migrations. Integration tests run against real PostgreSQL (Testcontainers).
- **Availability is computed in code**, never decided by the AI assistant.
- **TypeScript:** strict mode; no `any` without reason, no `@ts-ignore`, no `eslint-disable`, no skipped tests. Shared helpers live in `packages/shared`.
- **Mobile UI** is for an elderly user: text ≥ 18, touch targets ≥ 48dp, tokens from `apps/mobile/src/theme`, plain Russian wording.
- **Secrets** only in `.env` (git-ignored); document variables in `.env.example`.

## Brand
Logo sources and generator: `assets/brand/`, `scripts/brand/generate.mjs`. `npm run brand` rebuilds all images and the app icons.
