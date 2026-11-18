-- Only the API (table owner) reads and writes idempotency keys; staff get no policy on purpose.

alter table idempotency_keys enable row level security;
