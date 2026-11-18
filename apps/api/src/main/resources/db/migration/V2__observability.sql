-- Append-only history for statistics and diagnostics: domain events, AI runs, webhook deliveries.

create table events (
    id           uuid primary key default gen_random_uuid(),
    type         text not null check (type ~ '^[a-z]+(_[a-z]+)*$'),          -- e.g. appointment_created
    entity_type  text not null check (entity_type ~ '^[a-z]+(_[a-z]+)*$'),   -- e.g. appointment
    entity_id    uuid,                                                       -- no foreign key: may point to any table
    actor        text not null check (actor in ('client', 'bot', 'master', 'admin', 'system')),
    payload      jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
    created_at   timestamptz not null default now()
);
create index events_created_at_idx on events (created_at);
create index events_type_created_at_idx on events (type, created_at);
create index events_entity_idx on events (entity_type, entity_id, created_at);

create table ai_runs (
    id               uuid primary key default gen_random_uuid(),
    conversation_id  uuid references conversations (id) on delete set null,
    message_id       uuid references messages (id) on delete set null,   -- the inbound message being answered
    model            text not null,
    prompt_version   text,
    intent           text,
    status           text not null check (status in ('ok', 'error', 'timeout')),
    input_tokens     int check (input_tokens >= 0),
    output_tokens    int check (output_tokens >= 0),
    latency_ms       int check (latency_ms >= 0),
    cost_usd         numeric(12, 6) check (cost_usd >= 0),
    tool_calls       jsonb not null default '[]'::jsonb,
    error            text,
    created_at       timestamptz not null default now()
);
create index ai_runs_created_at_idx on ai_runs (created_at);
create index ai_runs_conversation_idx on ai_runs (conversation_id, created_at);

create table webhook_logs (
    id                uuid primary key default gen_random_uuid(),
    signature_valid   boolean not null,
    status            text not null default 'received'
                      check (status in ('received', 'processed', 'duplicate', 'rejected', 'failed')),
    error             text,
    payload           jsonb,                    -- null when the body was not valid JSON
    processed_at      timestamptz,
    created_at        timestamptz not null default now()
);
create index webhook_logs_created_at_idx on webhook_logs (created_at);
create index webhook_logs_status_idx on webhook_logs (status, created_at);
