# WhatsApp integration

Official **WhatsApp Cloud API** by Meta. Unofficial clients are not used: they violate WhatsApp terms and risk a ban of the master's number.

- **24-hour window:** free-form replies within 24 h after the client's last message (`conversations.last_inbound_at`); outside it only approved templates.
- **Templates** (reminders, confirmations) need Meta approval.
- **Interactive messages:** reply buttons (up to 3) and lists — service, day and time selection.
- **Pricing:** client-initiated service conversations are free; templates outside the window are paid.

Webhook: `GET /webhook/whatsapp` verification (`WHATSAPP_VERIFY_TOKEN`, constant-time comparison) ✅; `POST` with `X-Hub-Signature-256` check and idempotency by message id (M2).
