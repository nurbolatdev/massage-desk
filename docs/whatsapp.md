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
  - every delivery attempt writes a row to `webhook_logs` (signed JSON object → `received` with `payload`; refused → `rejected` without `payload`; signed body that is not a JSON object or contains `\u0000` → `200` and `failed`).
- Storing incoming messages and idempotency by message id follow in the next part of M2-2.
