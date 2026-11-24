# WhatsApp integration

Official **WhatsApp Cloud API** by Meta. Unofficial clients are not used: they violate WhatsApp terms and risk a ban of the master's number.

- **24-hour window:** free-form replies while `now < last_inbound_at + 24 h` (`conversations.last_inbound_at`); at exactly 24 h or later, or when the client has not sent any message yet, the window is closed and only approved templates can be sent.
- **Templates** (reminders, confirmations) need Meta approval.
- **Interactive messages:** reply buttons (up to 3) and lists — service, day and time selection.
- **Pricing:** client-initiated service conversations are free; templates outside the window are paid.

## Webhook

- `GET /webhook/whatsapp` ✅ — Meta endpoint verification (`WHATSAPP_VERIFY_TOKEN`, constant-time comparison).
- `POST /webhook/whatsapp` ✅ — verifies `X-Hub-Signature-256` (`sha256=` + HMAC-SHA256 of the raw body keyed by `WHATSAPP_APP_SECRET`, constant-time comparison):
  - missing or wrong signature, or an empty `WHATSAPP_APP_SECRET` → `403` without parsing the body;
  - body larger than 3 MiB → `413`;
  - every delivery attempt writes a row to `webhook_logs` (signed JSON object → `received` with `payload`; refused → `rejected` without `payload`; signed body that is not a JSON object or contains `\u0000` → `200` and `failed`);
  - a signed JSON object (`received`) is then processed in a separate transaction and updated with `processed_at` to `processed`, `duplicate` (every storeable message in the delivery was already stored), or `failed` (`error` holds the exception class name, `payload` is kept for replay, and the HTTP response is still `200`);
  - only `entry[].changes[]` with `field = "messages"` and `value.messages[]` of types `text`, `image`, `audio`, `video`, `document`, `sticker`, `location`, `contacts`, `interactive`, `button`, `unsupported` are stored (`body` is kept for `text` and for the title of a tapped button or list row — `interactive.button_reply.title`, `interactive.list_reply.title`, `button.text` — otherwise `null`; the reply id from `interactive.button_reply.id`, `interactive.list_reply.id`, or `button.payload`, trimmed; blank or longer than 256 code points means no reply id (`null`), otherwise it is forwarded in the `ClientMessageReceived` event; `reaction`, `system`, unknown types and `statuses` are ignored; messages without non-blank string `id`, `from` or `type` are skipped);
  - client and conversation: a digits-only `from` (`1..15` digits) is normalized as `"+" + from` with the default region (or kept if already E.164); on the first message the client (`client_created` with actor `client`) and their single `conversations` row are created with the trimmed WhatsApp `contacts[].profile.name` (up to 100 code points; an existing client's name is never overwritten);
  - timestamps and idempotency: `messages.created_at` comes from the WhatsApp `timestamp` (epoch seconds, falling back to the server clock; never later than the server clock, a future timestamp is replaced by the receive time); only newly inserted messages advance `conversations.last_inbound_at` and `last_message_at` (`greatest`); retries and parallel deliveries are deduplicated by the unique `messages.wa_message_id` (`on conflict do nothing`).

## Sending messages

- `WhatsAppClient` ✅ — sends `POST {WHATSAPP_API_URL}/{WHATSAPP_PHONE_NUMBER_ID}/messages` with `Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>` and returns the `messages[0].id` (`wa_message_id`).
- Message kinds (`OutboundMessage`, limits checked in code points before any HTTP request):
  - `Text`: body `1..4096` (`preview_url = false`);
  - `Buttons`: body `1..1024`, `1..3` reply buttons (`id` `1..256`, `title` `1..20`, both unique);
  - `ListMenu`: body `1..1024`, button label `1..20`, `1..10` rows in a single section (`id` `1..200` unique, `title` `1..24`, optional `description` `1..72`);
  - `Template`: name `^[a-z0-9_]{1,512}$`, language `^[a-z]{2,3}(_[A-Z]{2})?$` (`ru`, `en_US`), body parameters `1..1024` each without `\n`, `\t`, or 5+ consecutive spaces.
- Recipient: E.164 phone from `clients.phone` (`^\+[1-9][0-9]{6,14}$`), sent in `to` as digits without `+`.
- Timeouts and redirects: `app.whatsapp.api.connect-timeout` is `5s`, `read-timeout` is `15s` (each `> 0` and `<= 60s`); HTTP redirects are never followed.
- Empty environment variables: if any of `WHATSAPP_API_URL`, `WHATSAPP_ACCESS_TOKEN`, or `WHATSAPP_PHONE_NUMBER_ID` is empty, the API starts normally and `send` throws `WhatsAppSendException(NOT_CONFIGURED)` without making an HTTP request.
- Retries and error classification: the client never retries; failures are mapped to `WhatsAppSendException` (whose message never includes tokens, phone numbers, message text, or Meta's `error.message`) in this order:

  | Condition | `Reason` | `retryable` |
  |---|---|---|
  | `WHATSAPP_API_URL`, `WHATSAPP_ACCESS_TOKEN`, or `WHATSAPP_PHONE_NUMBER_ID` is empty | `NOT_CONFIGURED` | no |
  | no response: I/O error or timeout (`ResourceAccessException`) | `UNAVAILABLE` | yes |
  | HTTP `401` or Meta `error.code = 190` | `UNAUTHORIZED` | no |
  | HTTP `429` or Meta `error.code` in `{4, 80007, 130429, 131056}` | `RATE_LIMITED` | yes |
  | HTTP `5xx` | `UNAVAILABLE` | yes |
  | other HTTP `4xx` (including `131047` outside window and `131026` undeliverable; `131047` is turned into `OutsideWindowException` by `OutboundMessages`) | `REJECTED` | no |
  | HTTP `2xx` whose body cannot be read, has no non-blank `messages[0].id`, or is not valid JSON | `INVALID_RESPONSE` | no |

### Window and stored messages

- `OutboundMessages.send(conversationId, author, message)` ✅ — the only entry point for outgoing messages (`Author`: `BOT`, `MASTER`; returns `Sent(messageId, waMessageId)` with the stored `messages.id` and `wa_message_id`).
- Recipient: read from the conversation's client phone (`clients.phone`); an unknown `conversationId` throws `IllegalArgumentException` before any HTTP request.
- 24-hour window (`WhatsAppWindow`): open while `now < last_inbound_at + 24 h` (`Clock`); at exactly 24 h or later, or when `last_inbound_at` is `null` (no client message yet), the window is closed and only `OutboundMessage.Template` is allowed.
- `OutsideWindowException`: thrown for non-template messages outside the window before any HTTP request or database write, and also when WhatsApp rejects a send with Meta error code `131047` (with the `WhatsAppSendException` as cause).
- Storing accepted messages: written to `messages` only after WhatsApp accepted the send (`direction = 'out'`, `author` = `'bot'` or `'master'`, `body` = text / interactive body for `Text`, `Buttons`, `ListMenu` or `null` for `Template`, `wa_message_id` from the response, `created_at` from the server clock), deduplicated by `wa_message_id` (`on conflict (wa_message_id) do nothing`, returning the existing `messages.id` when it belongs to an outgoing message of the same conversation, or throwing `IllegalStateException` if `wa_message_id` is already stored for another message); `conversations.last_message_at` is advanced with `greatest(last_message_at, at)` only when a new row is inserted, and `last_inbound_at` is never changed.
- No database transaction during the HTTP request: reading the recipient/window and storing the message are single SQL statements, so the HTTP call never holds a database connection or lock; `send` refuses to run inside a database transaction (`IllegalStateException` before any database read or HTTP request).
- Failed sends (`WhatsAppSendException` or `OutsideWindowException`) are not stored and not retried; a send accepted by WhatsApp (`200`) whose database write fails afterwards propagates the error and is not resent.
- `conversations.human_mode` (checked by `BookingBot`) and delivery status webhooks (`statuses`) are not handled in `OutboundMessages`.

## Bot (button booking)

- `ClientMessageReceived(conversationId, clientId, waMessageId, text, replyId)` ✅ — published by `WebhookDeliveries` after `InboundMessages.store` commits and `webhook_logs` is saved, outside any database transaction, in delivery order, only for newly stored messages (never for duplicates or failed deliveries). Each listener call is wrapped in `try/catch`: a runtime exception is logged at `WARN` (exception class name only) without blocking subsequent events, and the webhook response is always `200`.
- `BookingBot` ✅ — synchronous `@EventListener` for `ClientMessageReceived`:
  - checks `settings.bot_enabled` and `conversations.human_mode`: silent when the bot is disabled, the conversation does not exist, or `human_mode` is `true`;
  - stores conversation state in `bot_sessions` (steps `menu`, `service`, `day`, `time`, `confirm`, `move_pick`, `cancel_pick`, `cancel_confirm`); a session lives for 24 hours (`updated_at + 24 h > now` from the API clock; at 24 h or older it restarts from `menu`);
  - saves the next state to `bot_sessions` before sending replies, so a failed send leaves the conversation on that step and the next client message repeats the prompt;
  - sends replies only through `OutboundMessages.send(..., Author.BOT, ...)`, which refuses to run inside a database transaction (`IllegalStateException`);
  - `menu` ✅ — sends `"Здравствуйте! Я помогу записаться на массаж."` with reply button `book` (`"Записаться"`);
  - `service` ✅ — on `replyId = "book"` from `menu` (or any input while on `service`), sends `"Выберите массаж из списка."` (button `"Выбрать массаж"`, up to 10 active services in catalog order, row id `service:<uuid>`, title truncated to 24 code points with `…`, description `<duration> мин · <price> ₸` with non-breaking spaces), or returns to `menu` with `"Сейчас запись через бота недоступна. Мастер увидит ваше сообщение и ответит."` when no services are active;
  - day and time selection and booking confirmation (`day`, `time`, `confirm`) — planned (part 2);
  - rescheduling and cancelling upcoming appointments (`move_pick`, `cancel_pick`, `cancel_confirm`) — planned (part 3).
- Tests: the test setup pins `app.whatsapp.api.url` to an empty value, so `WhatsAppClient` stops with `WhatsAppSendException(NOT_CONFIGURED)` without network calls even when `WHATSAPP_API_URL`, `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are exported in the shell.
