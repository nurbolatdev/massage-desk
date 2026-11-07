# massage desk — Design Language

> Source of truth for the master app (`apps/mobile`, Android) and the admin panel (`apps/admin`). Both use the same tokens. Version 1.0.0 · 2026-11-02.

## 1. Visual Theme
**Calm, legible, unhurried tool** — a paper notebook that answers WhatsApp for you.

- **Character:** calm (stone greens, warm paper background), plain (one main action per screen), generous (large type and targets).
- **Primary user:** a middle-aged massage therapist, non-technical, uses the app between sessions with one hand. Every decision must survive the question "can he do this in 2 seconds without reading twice?"
- **Brand:** logo "massage stones" — three stacked stones (greens) with an orange dot (attention).
- **References:** paper appointment book; WhatsApp chat layout; large-text accessibility modes on Android.

## 2. Color Palette
Light theme only. Every text pair below is ≥ 4.5:1 unless marked as a border/decorative token. `Used` = occurrences across the mockups.

### Neutral Scale
| Token | Value | Text on it | Contrast | Used | Use |
|---|---|---|---|---|---|
| `ink` | `#14332E` | `#FAF6EF` | 12.6:1 | 237 | Primary text, headings |
| `muted` | `#4F615B` | `#FAF6EF` | 6.1:1 | 262 | Secondary text, captions |
| `neutral-soft` | `#ECE7DF` | `#4A4840` | 7.4:1 | 24 | Manual / cancelled chips, day off |
| `bg` | `#FAF6EF` | `#14332E` | 12.6:1 | 38 | Mobile background |
| `bg-page` | `#F6F1E8` | `#14332E` | 12.1:1 | 35 | Admin page background |
| `surface` | `#FFFFFF` | `#14332E` | 13.6:1 | 436 | Cards, inputs, lists |
| `line` | `#E6DCCB` | `#14332E` | 10.0:1 | 177 | Card and table outlines (decorative) |
| `divider` | `#F0E8DB` | `#14332E` | 11.2:1 | 210 | Row separators |
| `border-strong` | `#8A8478` | `#FFFFFF` | 3.7:1 | 82 | Inputs, secondary buttons, switch off (≥ 3:1 on white) |
| `border-dashed` | `#B5AC9C` | `#14332E` | 6.1:1 | 11 | "Free time" dashed row (decorative) |
| `text-strong` | `#34433F` | `#FFFFFF` | 10.4:1 | 60 | Offline banner, block labels |
| `neutral-strong` | `#4A4840` | `#ECE7DF` | 7.4:1 | 14 | Text on neutral-soft |
| `neutral-fg` | `#6B675C` | `#EFE7DA` | 4.6:1 | 25 | Busy time, disabled text |
| `segment-bg` | `#EFE7DA` | `#14332E` | 11.1:1 | 72 | Segmented controls, skeletons |
| `disabled-bg` | `#E3DCCF` | `#6B675C` | 4.1:1 | 4 | Disabled button |

### Brand Scale
| Token | Value | Text on it | Contrast | Used | Use |
|---|---|---|---|---|---|
| `primary` | `#1F6F5C` | `#FFFFFF` | 6.0:1 | 171 | Primary buttons ("Book"), selected time, next-client card |
| `primary-strong` | `#155445` | `#DDF0E9` | 7.4:1 | 120 | Text on light green, active tab, pressed primary |
| `primary-soft` | `#DDF0E9` | `#155445` | 7.4:1 | 65 | Bot bubbles, "on" chips |
| `stone-dark` | `#14362F` | `#FFFFFF` | 13.1:1 | 15 | Admin sidebar, dark surfaces |
| `stone-light` | `#7FD6BE` | `#14362F` | 7.7:1 | 61 | Switch on, accents on dark, charts |
| `accent` | `#F0603C` | `#2B0E05` | 5.5:1 | 48 | Attention only: chat badge, help icon |
| `accent-soft` | `#FDE3D6` | `#8A2E12` | 6.9:1 | 13 | "Needs your reply" banners and cards, no-show chip |
| `primary-mid` | `#1E8A72` | `#FFFFFF` | 4.3:1 | 57 | Switch on, chart bars, icons (not small text) |
| `primary-faint` | `#EEF7F3` | `#155445` | 8.1:1 | 25 | Selected row, info boxes |
| `on-primary-muted` | `#CDEDE3` | `#1F6F5C` | 4.8:1 | 41 | Secondary text on primary |
| `on-accent` | `#2B0E05` | `#F0603C` | 5.5:1 | 23 | Text on accent |
| `accent-strong` | `#8A2E12` | `#FDE3D6` | 6.9:1 | 23 | Text on accent-soft |
| `stone-mid` | `#1B4038` | `#FFFFFF` | 11.4:1 | 10 | Cards on dark sidebar |
| `brand-mid` | `#34A88C` | `#14332E` | 4.6:1 | 21 | Logo mark, success check |

### Semantic Colors
| Token | Value | Text on it | Contrast | Used | Use |
|---|---|---|---|---|---|
| `danger` | `#B3261E` | `#FFFFFF` | 6.5:1 | 10 | Destructive confirm, error text |
| `danger-soft` | `#F6D9D4` | `#5A1409` | 10.3:1 | 13 | Error banners |
| `note` | `#FFF6DE` | `#14332E` | 12.6:1 | 4 | Client notes |
| `info-soft` | `#EEF3F7` | `#1D3A52` | 10.6:1 | 5 | WhatsApp rule hints |
| `warning-icon` | `#C2451F` | `#FFFFFF` | 5.0:1 | 20 | Warning icons |
| `danger-strong` | `#8A1F12` | `#F6D9D4` | 6.9:1 | 15 | Text on danger-soft |
| `manual-soft` | `#FBE7DC` | `#8A2E12` | 7.1:1 | 3 | Manual bookings in admin schedule |
| `manual-border` | `#E58A66` | `#14332E` | 5.3:1 | 6 | Manual booking outline, manual chart series |
| `danger-border` | `#E9B4A6` | `#B3261E` | 3.6:1 | 4 | Outline of secondary destructive button |
| `info-strong` | `#1D3A52` | `#EEF3F7` | 10.6:1 | 6 | Text and icon on info-soft |

**Semantic roles:** success → `primary-soft` / `primary-strong`; warning and "needs attention" → `accent-soft` / `accent-strong` / `warning-icon`; error → `danger-soft` / `danger-strong` / `danger`; info → `info-soft` / `info-strong`.
**Orange is reserved for attention** (help banners, chat badge, no-show). Primary actions are always `primary` green.

## 3. Typography
**Family:** Inter — `font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Weights 400, 500, 600, 700, 800. Sentence case everywhere, no ALL CAPS.

| Role | Mobile (sp / weight / line-height) | Admin (px / weight / line-height) | Example |
|---|---|---|---|
| display | 46 / 800 / 1.05 | — | Next client time "10:00" |
| hero | — | 40 / 800 / 1.15 | Admin sign-in |
| title | 32 / 800 / 1.15 | 30 / 800 / 1.2 | Screen / page title, KPI number |
| title-s | 24 / 800 / 1.2 | 20 / 800 / 1.25 | Dialog / sheet title |
| subtitle | 21 / 700 / 1.25 | 17 / 700 / 1.3 | Client name, block title |
| body | 18 / 500 / 1.45 | 14 / 500 / 1.5 | Main text, buttons (700–800) |
| secondary | 16 / 500 / 1.4 | 13 / 600 / 1.45 | Captions, hints |
| label | 14 / 700 / 1.3 | 12 / 700 / 1.3 | Chips, tab labels, badges |

Minimum: 14 sp on mobile, 12 px in admin. Mobile layouts must work at 130 % system font scale.

## 4. Components
| Component | Purpose | Key variants / states | Status |
|---|---|---|---|
| Button (mobile) | Actions, 56–62 high, full width | primary, secondary, destructive, disabled primary (grey `disabled-bg` with `neutral-fg` text, not half-transparent: a faded button reads as broken; other variants keep the faded look for now), pressed, focus | planned |
| Button (admin) | Actions, 44 / 36 high | primary, secondary, destructive, destructive-solid, ghost, small, focus | planned |
| Text field | Phone, name, notes | default, focus, error with message, filled, disabled | planned |
| Status chip | Unusual status only | manual, cancelled, no-show, needs help, done, bot, you, error | planned |
| Time slot | Pick a time | free, busy (struck + `neutral-fg`), selected (`primary`), just taken (`danger-soft`) | planned |
| Day picker | Pick a day | default, selected (`ink`), day off | planned |
| Segmented control | Week/month, bot/me | default, selected | planned |
| Switch | On/off settings | on (`stone-light`), off (`border-strong`) — separate control, never nested in a row link | planned |
| Appointment row | Day list | confirmed, manual (+chip) | planned |
| Free-time row | Gap in the day | dashed | planned |
| Next-client card | Hero on Today | with call / WhatsApp | planned |
| Banner | Status messages | needs reply, offline, error, info (template only), bot off | planned |
| Toast | Confirmation | success with "Undo", error | planned |
| Bottom sheet | Mobile dialog | confirm, note, templates | planned |
| Dialog | Admin dialog, 440–520 wide | booking, move, cancel, day off, service, client | planned |
| Tab bar | Mobile navigation, 4 tabs | active, badge with label | planned |
| Sidebar | Admin navigation | active, badge, status dot; top bar on phones | planned |
| Chat bubble | Conversation | client, bot, master, system | planned |
| Data table | Admin lists | default, selected row, empty, loading, error | planned |
| Empty / loading / error state | Every list and page | icon + title + one sentence + action | planned |

## 5. Layout
- **Base unit:** 2 px; spacing scale **2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64**.
- **Mobile:** 390 dp reference width, 16 dp side padding, single column, bottom tab bar 78 dp, primary action pinned above the tab bar.
- **Admin:** sidebar 240 px + fluid content (`flex: 999 1 560px`), page padding 28 × 32, cards in `repeat(auto-fit, minmax(380px, 1fr))` grids, 16 px gutters.
- **Radius scale:** 4, 6, 8, 10, 12, 14, 16, 18, 22, 28, 999.
- **Touch targets:** ≥ 48 dp mobile, ≥ 44 px admin.

## 6. Depth
| Level | Use | Value |
|---|---|---|
| 0 | Page | flat background |
| 1 | Mobile card / row | `0 1px 0 #E6DCCB` |
| 1 | Admin card | `1px solid #E6DCCB` border, no shadow |
| 2 | Toast | solid `ink` surface, no shadow |
| 3 | Dialog / bottom sheet | `0 20px 50px rgba(13,34,30,.25)` over scrim `rgba(20,51,46,.5)` |

| z-index | Layer |
|---|---|
| 0 | Content |
| 10 | Sticky bottom action, tab bar |
| 50 | Toast |
| 100 | Scrim + sheet / dialog |

## 7. Do's and Don'ts
### Do
- Put the next client on top of Today, with call and WhatsApp one tap away.
- Ask for confirmation before cancel, no-show, bot off and sign-out — and say what will happen ("the client will get a message").
- Show offline state as a banner; keep calling possible, block edits.
- Use verbs on buttons ("Call", "Book", "Move"); write time as "10:00", not "slot".
- Ship every screen with its empty, loading, offline and error states.
- Keep "needs your reply" visible on Today and as a badge on Chats.

### Don't
- Don't use orange for primary actions — orange means "attention".
- Don't show a status chip for the default state (confirmed).
- Don't put a switch inside a tappable row; make the row and the switch separate controls.
- Don't rely on color alone — every color has a word (chip, label or legend).
- Don't use ALL CAPS, jargon ("slot", "escalation", "lead") or text under 14 sp on mobile.
- Don't let blocks shrink under large fonts — content scrolls, button rows wrap.

## 8. Responsive
**Strategy:** the master app is phone-only (Android, portrait). The admin panel is desktop-first and must work on a phone.

| Element | Phone | Desktop |
|---|---|---|
| Admin navigation | Top bar + expandable menu | Left sidebar 240 px |
| Admin data tables | Horizontal scroll inside the card | Full width |
| Admin side panels | Stack under the main content | Right column |
| Dialogs | Bottom sheet (mobile app) | Centered dialog 440–520 px |
| Mobile button rows | Wrap to one per row at large font | — |

## 9. Implementation Rules
**When building UI for this project:**
- Use tokens from Sections 2–6 only; never raw hex or off-scale pixel values.
- Check the matching mockup and all of its states before building a screen.
- Prefer components from Section 4; propose a new one only with a reason.
- Treat Section 7 as hard rules.

**Invariants:**
- Primary actions are `primary` green; `accent` orange is attention only.
- Body text 18 sp on mobile; nothing under 14 sp.
- Destructive actions always confirm.
- Light theme only.

**Open questions / known gaps:**
- Dark theme is not defined.
- Kazakh and Uzbek UI strings are not designed (the bot answers in them; the app UI is Russian).
- Real prices, address and working hours are placeholders until confirmed by the master.

## 10. Motion
The mockups define no animation. Defaults until designed: durations fast 100 ms · base 200 ms · slow 300 ms; easing standard `cubic-bezier(0.2,0,0,1)`; sheets and dialogs fade + slide up (base), toasts fade (fast). Animate only `transform` and `opacity`. Honor reduced motion: replace movement with an instant change.

## 11. Voice & Tone
**Voice:** calm, plain, respectful. Address the master as «вы». The app UI is Russian.

| Use | Avoid |
|---|---|
| время | слот |
| Нужна ваша помощь / Ждут вашего ответа | эскалация |
| Записать клиента | создать запись / бронирование |
| Клиент не пришёл | no-show |
| Бот отвечает / Отвечаю я | AI-агент, human mode |

**Microcopy:** buttons are imperative verbs; errors say what happened and what to do next; sentence case; numbers with a non-breaking space before units (`60 мин`, `8 000 ₸`).
