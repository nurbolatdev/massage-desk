# AI assistant

Turns free-text messages into actions. It never decides availability or prices itself — it calls tools that run the same domain code as the app.

| Tool | Effect |
|---|---|
| `get_services` | Services, prices, durations |
| `find_slots` | Free times from the slot calculator |
| `create_booking` | Only after an explicit "yes" from the client |
| `get_client_bookings` | Upcoming appointments |
| `reschedule_booking` / `cancel_booking` | Changes |
| `escalate_to_human` | Hand-off to the master + push |

**Guardrails:** introduces itself as the master's AI assistant; facts only from tools; summary and confirmation before booking; escalation for medical questions, complaints, uncertainty; replies in the client's language (Russian, Kazakh, Uzbek); silent while the master has taken over.

**Provider-neutral:** the model is called over plain HTTP; endpoint, model and key come from environment variables (`AI_API_URL`, `AI_MODEL`, `AI_API_KEY`).

**Quality:** 30–50 reference conversations with automated checks (M3); every run is stored in `ai_runs` (tools, tokens, cost, latency, errors) and shown in the admin panel.
