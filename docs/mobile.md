# Mobile app (master)

Expo SDK 58, Expo Router (`apps/mobile/src/app`), installed as an APK via EAS Build.

| Tab | Purpose | Status |
|---|---|---|
| Today | Next client in large type, call and WhatsApp buttons, day list | Done in M1-11; see [Today](#today) |
| Calendar | Week and month | M1 |
| Chats | Conversations and "I'll answer" take-over | M2 |
| Settings | Days off and vacation | M1 |

**UX for an elderly user:** text 18–34, touch targets ≥ 56dp, high contrast, verbs on buttons, confirmation for destructive actions, plain wording. Tokens only from `src/theme`.

## Today

Done: next client in large type with call and WhatsApp buttons; the rest of the day with free time; empty, bot-off, loading, offline and error states; a warning with «Обновить» when a refresh fails.

Later:

- the «Записать клиента» button and the «Запись создана» confirmation ([M1-13](roadmap.md#m1))
- the «ждут вашего ответа» banner and the badge on Chats ([M2-5](roadmap.md#m2))
- breaks in the working hours are still shown as free time ([M1-23](roadmap.md#m1))

## Appointment card

Done in M1-12. The next-client card and every row on Today open it. It shows the time, service, client and who booked; call and WhatsApp buttons; the client's note with quick phrases (saved with `PATCH /clients/{id}`); and, for a confirmed appointment, «Отменить» and, once it has started, «Не пришёл». Both destructive actions ask for confirmation, and no request is sent before «Да». The status chip is shown only for unusual statuses (cancelled, no-show, done), not for a confirmed one. States: loading, offline, error, «Запись не найдена».

- The card route is `/appointment/<id>?day=YYYY-MM-DD`. The API has no single-appointment endpoint, so the card finds the appointment in the list of that day (same cache as Today). Without `day` it shows «Запись не найдена» ([#59](https://github.com/nurbolatdev/massage-desk/issues/59)).
- Not shown yet, because the API does not provide it: price, who cancelled and when, visit history, the no-show counter. «Перенести» comes with M1-13.

## Data

- Setup: set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (see `.env.example`). On a phone use the computer's LAN address, not `localhost`.
- The app reads the schedule through the API with a client built from the generated OpenAPI types. A `401` answer signs the master out on this device.
- The day is the master's day: it is computed in the time zone from the settings.
- The last loaded data is kept on the device for 7 days and cleared at sign-out.
- Offline, the app shows the saved schedule with a banner; edits are blocked.
- Live updates: a change in `appointments` makes the app reload the list from the API.

## Sign-in

The master signs in with email and password. There is no registration: staff accounts are created as described in [API authentication](api.md#authentication).

Setup: copy `apps/mobile/.env.example` to `apps/mobile/.env` and fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both values are public client values; the real `.env` is never committed.

The session lives in the device's secure storage. It is split into parts because of the per-value size limit, and it refreshes while the app is open. Without a session only the sign-in screen is reachable. Sign-out is in Settings and asks for confirmation.

## Tests

`npm test --workspace apps/mobile` (jest-expo). Component and hook tests use React Native Testing Library (v14: `render`, `renderHook` and `act` are asynchronous, so `await` them). Screen tests live in `src/__tests__/`, not in `src/app/`, because Expo Router treats every file there as a route.
