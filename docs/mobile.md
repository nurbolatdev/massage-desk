# Mobile app (master)

Expo SDK 58, Expo Router (`apps/mobile/src/app`), installed as an APK via EAS Build.

| Tab | Purpose | Status |
|---|---|---|
| Today | Next client in large type, call and WhatsApp buttons, day list | skeleton, mock data |
| Calendar | Week and month | M1 |
| Chats | Conversations and "I'll answer" take-over | M2 |
| Settings | Days off and vacation | M1 |

**UX for an elderly user:** text 18–34, touch targets ≥ 56dp, high contrast, verbs on buttons, confirmation for destructive actions, plain wording. Tokens only from `src/theme`.

**Data (M1):** API client from generated OpenAPI types, cached for offline use, live updates via Supabase Realtime.
