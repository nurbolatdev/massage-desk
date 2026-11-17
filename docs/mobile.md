# Mobile app (master)

Expo SDK 58, Expo Router (`apps/mobile/src/app`), installed as an APK via EAS Build.

| Tab | Purpose | Status |
|---|---|---|
| Today | Next client in large type, call and WhatsApp buttons, day list | Done in M1-11; see [Today](#today) |
| Calendar | Week and month | Week and month views, days off done in M1-14; see [Calendar](#calendar) |
| Chats | Conversations and "I'll answer" take-over | M2 |
| Settings | Days off and vacation | Done in M1-15; see [Days off and vacation](#days-off-and-vacation) |

**UX for an elderly user:** text 18–34, touch targets ≥ 56dp, high contrast, verbs on buttons, confirmation for destructive actions, plain wording. Tokens only from `src/theme`.

**Cards:** white cards and rows use `Surface` or `PressableSurface` (`src/components/Surface.tsx`): the `surface` background with the level-1 depth `depth.level1` from `src/theme` (DESIGN.md section 6). Tinted cards, banners and controls stay flat. `src/__tests__/depthGuard.test.ts` fails if a shadow is written anywhere else.

## Today

Done: next client in large type with call and WhatsApp buttons; the rest of the day with free time; empty, bot-off, loading, offline and error states; a warning with «Обновить» when a refresh fails; the «Записать клиента» button and the «Записано» notice with «Отменить» after a booking (M1-13). Breaks between working blocks are shown as «Перерыв до …», and free time is shown only inside the working hours (none while the hours are unknown or on a day without hours) (M1-23).

Later:

- the «ждут вашего ответа» banner and the badge on Chats ([M2-5](roadmap.md#m2))
- free time on Today does not subtract partial time off yet

## Calendar

Done (part 1 of M1-14): the week Monday to Sunday with the number of appointments under each day; arrows to move to the previous or next week; tap a day to see its appointments; tap a row to open the appointment card. Free time between appointments is shown for today and future days. Cancelled appointments are hidden and not counted. States are the same as on Today: loading, offline, error, and a warning when a refresh fails. The «Записать клиента» button opens a new appointment.

Done (part 2 of M1-14): the «Неделя / Месяц» switch; the month grid with the number of appointments under each day, loaded in one request; tap a day to see its card («Первая в …, свободно …») and its appointments; tap the card to open that week; arrows move by month. Day cells have a touch area of at least 48 dp from a 360 dp wide screen. While loading, a day is read out without a summary.

Done (part 3 of M1-14): a day fully covered by time off is grey and signed «Выходной» in the week and the month, shows the «Выходной день — бот не предлагает это время» card and a disabled «Выходной — запись закрыта» button. An empty today or future day without time off says «Свободно весь день». The button books for the picked day when it is within the 8 booking days («Записать на пн, 2 ноября», opens `/new-appointment?day=YYYY-MM-DD`); otherwise it opens a new appointment on today. A today or future day with partial time off and no appointments says «Записей нет» / «На этот день записей нет», not «Свободно».

Done (part 4 of M1-14): after a booking made from the calendar the «Записано» notice with «Отменить» is shown there, as on Today (only on the tab that is open). Coming back to the Calendar tab from another tab opens today; returning from an appointment card keeps the picked day, and the week or month view is kept. The loading skeleton shows only the rows.

Done (#79): the calendar reads the working hours of the picked day. Breaks between working blocks are shown as «Перерыв до …», free time is shown only inside the working hours (none while the hours are unknown), and the month card names only real free time. An empty future day still says «Свободно весь день» without a time.

Later:

- marking days off and vacations in the app ([M1-15](roadmap.md#m1-15--days-off-and-vacation))
- partial time off is not drawn yet and free gaps do not subtract it
- weekly days off are not used: the master works every day
- «Свободно весь день» does not use the working hours yet (no start time)

## Appointment card

Done in M1-12. The next-client card and every row on Today open it. It shows the time, service, client and who booked; call and WhatsApp buttons; the client's note with quick phrases (saved with `PATCH /clients/{id}`); and, for a confirmed appointment, «Перенести», «Отменить» and, once it has started, «Не пришёл». Every action asks for confirmation, and no request is sent before «Да». The status chip is shown only for unusual statuses (cancelled, no-show, done), not for a confirmed one. States: loading, offline, error, «Запись не найдена».

- The card route is `/appointment/<id>?day=YYYY-MM-DD`. The API has no single-appointment endpoint, so the card finds the appointment in the list of that day (same cache as Today). Without `day` it shows «Запись не найдена» ([#59](https://github.com/nurbolatdev/massage-desk/issues/59)).
- Not shown yet, because the API does not provide it: price, who cancelled and when, visit history, the no-show counter.

## Reschedule

Opened from «Перенести» on the card of a confirmed appointment. The master picks a new day and a free time; the booked length is kept.

- The app asks for confirmation first; no request is sent before «Да, перенести».
- Only free times are offered. If the time was taken meanwhile (409), the master sees an alert and the list of times is refreshed.
- Offline, the button is disabled.
- The client gets no message about the move.
- Known limitation: times that overlap the current appointment are not offered, because the free-time list counts the appointment itself as busy.

## New appointment

Done in M1-13. Opened from «Записать клиента» on Today. Three steps: pick a client (with search), pick a service, then pick a day and a free time.

- Only free times are offered. A time that is taken cannot be chosen.
- If the time was taken meanwhile (409), the master sees an alert and the list of free times is refreshed.
- Offline, a banner explains that booking needs the internet, and the button is disabled.
- The client gets no message about the booking yet.

## Days off and vacation

Done in M1-15. Opened from the row «Выходные и отпуск» in Settings. The row shows the nearest period (for example «Отпуск · 15 – 22 декабря и ещё 2») or «Отпуск не задан».

- The list «Выходные и отпуск» shows current and future days off, vacations and part-day time off, ordered by start. It covers everything that can be stored (two years ahead).
- «Добавить даты» opens the picker: the master taps one day (a day off) or a first and a last day (a vacation) on a month grid and presses «Сохранить». After saving the master returns to the list.
- A vacation is up to 365 days, from today up to two years ahead. Past days cannot be picked.
- The grid shows the number of appointments per day, so busy days are visible before closing them.
- The time off is stored from local midnight of the first day to the next local midnight after the last day, in the master's time zone. Free times for those days disappear from the bot and from booking.
- If confirmed appointments fall inside, the master sees who and when and must confirm. The appointments are kept: the master moves or cancels them. Nothing is closed without the confirmation.
- Removal asks for confirmation, removes the whole period and reopens the time for the bot and booking.
- Offline, the list is shown from the saved copy; saving and removal are disabled and a banner explains why.
- Known gaps: no weekly days off (they belong to working hours), part-day time off is not drawn in the calendar, no warning under a stored period that still has appointments.

## Data

- Setup: set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (see `.env.example`). On a phone use the computer's LAN address, not `localhost`. For the APK the URL comes from the build environment, see [Build and install](#build-and-install).
- The app reads the schedule through the API with a client built from the generated OpenAPI types. A `401` answer signs the master out on this device.
- The day is the master's day: it is computed in the time zone from the settings.
- The last loaded data is kept on the device for 7 days and cleared at sign-out.
- Offline, the app shows the saved schedule with a banner; edits are blocked.
- Live updates: a change in `appointments` makes the app reload the list from the API.

## Sign-in

The master signs in with email and password. There is no registration: staff accounts are created as described in [API authentication](api.md#authentication).

Setup: copy `apps/mobile/.env.example` to `apps/mobile/.env` and fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both values are public client values; the real `.env` is never committed.

The session lives in the device's secure storage. It is split into parts because of the per-value size limit, and it refreshes while the app is open. Without a session only the sign-in screen is reachable. Sign-out is in Settings and asks for confirmation.

## Build and install

### Build profiles

Configured in `apps/mobile/eas.json`:

- `production` — APK for the master's phone, update channel `production`.
- `preview` — `extends: "production"`, APK for a test phone, update channel `preview`.

Both profiles use internal distribution (`distribution: "internal"`) and build a signed APK (`android.buildType: "apk"`), without Google Play. `cli.appVersionSource: "remote"` and `autoIncrement: true` increment the Android build number on EAS for every build, so a new APK installs over the old one and keeps the master's session. EAS creates and stores the Android signing key on the first build — never reset it, otherwise a new APK will not install over the existing one and the master would have to uninstall and sign in again.

### Environment variables

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://<service>.onrender.com` (see [deploy.md](deploy.md)); HTTPS only — a release build blocks plain `http` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co`, the production Supabase project |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key of the production Supabase project |

Set the values in EAS environment variables for both `production` and `preview` (never commit real values or put them in `eas.json`):

```bash
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://<service>.onrender.com --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<project-ref>.supabase.co --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <publishable-key> --visibility sensitive
```

Repeat with `--environment preview`. Use `--visibility plaintext` for URLs and `--visibility sensitive` for the publishable key — never `secret`, because `secret` variables cannot be read locally during `eas update`, and all `EXPO_PUBLIC_*` values are public client values compiled into the APK anyway. Without these three variables the app throws an error on start.

### First build (once)

1. Install the EAS CLI (`npm i -g eas-cli`) and run `eas login`.
2. In `apps/mobile`, run `eas init` and `eas update:configure` (this writes `extra.eas.projectId` and `updates.url` into `apps/mobile/app.json` — commit the change).
3. Create the three EAS environment variables above for `preview` and `production`.
4. Run `eas build -p android --profile preview` in `apps/mobile` and verify the APK on a test phone.
5. Run `eas build -p android --profile production` and install it on the master's phone.

### Install on a phone

Open the build link on the phone, download the APK, allow installing apps from that browser when Android asks (once), install, open the app, and sign in. Check that the app icon and splash screen match the brand assets. Subsequent APK builds install the same way, directly over the old app without uninstalling.

### Updates without reinstalling

For JS-only changes (run from `apps/mobile`):

```bash
eas update -p android --channel preview --environment preview
# check on the test phone, then:
eas update -p android --channel production --environment production
```

The app downloads updates in the background (`updates.checkAutomatically: "ON_LOAD"`, `fallbackToCacheTimeout: 0`) and applies them on the next start. The app is Android-only, so updates are published with `-p android`. Always pass `--environment`: without it, a local `.env` with a LAN address could be bundled and sent to the master's phone.

For native changes (adding a package with native code, changing `app.json` plugins, icon, splash, Android settings, or upgrading the Expo SDK), bump `version` in `apps/mobile/app.json` (`runtimeVersion` uses policy `appVersion`) and build a new APK — an OTA update never reaches an app with a different runtime version.

To roll back a bad update, find the previous update group with `eas update:list` and republish it:

```bash
eas update:republish --group <group-id> --destination-channel production
```

### Known gaps

- No in-app version or update indicator yet.
- On the free Render plan the first API request after idle takes about a minute.

## Tests

`npm test --workspace apps/mobile` (jest-expo). Component and hook tests use React Native Testing Library (v14: `render`, `renderHook` and `act` are asynchronous, so `await` them). Screen tests live in `src/__tests__/`, not in `src/app/`, because Expo Router treats every file there as a route.
