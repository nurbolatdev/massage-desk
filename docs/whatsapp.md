# WhatsApp integration

Official **WhatsApp Cloud API** by Meta. Unofficial clients are not used: they violate WhatsApp terms and risk a ban of the master's number.

- **24-hour window:** free-form replies within 24 h after the client's last message (`conversations.last_inbound_at`); outside it only approved templates.
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
  - only `entry[].changes[]` with `field = "messages"` and `value.messages[]` of types `text`, `image`, `audio`, `video`, `document`, `sticker`, `location`, `contacts`, `interactive`, `button`, `unsupported` are stored (`body` is kept only for `text`, otherwise `null`; `reaction`, `system`, unknown types and `statuses` are ignored; messages without non-blank string `id`, `from` or `type` are skipped);
  - client and conversation: a digits-only `from` (`1..15` digits) is normalized as `"+" + from` with the default region (or kept if already E.164); on the first message the client (`client_created` with actor `client`) and their single `conversations` row are created with the trimmed WhatsApp `contacts[].profile.name` (up to 100 code points; an existing client's name is never overwritten);
  - timestamps and idempotency: `messages.created_at` comes from the WhatsApp `timestamp` (epoch seconds, falling back to the server clock); only newly inserted messages advance `conversations.last_inbound_at` and `last_message_at` (`greatest`); retries and parallel deliveries are deduplicated by the unique `messages.wa_message_id` (`on conflict do nothing`).
