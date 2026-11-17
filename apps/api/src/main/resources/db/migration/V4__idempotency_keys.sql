-- Idempotency-Key records for POST /appointments, scoped per staff member (user_id).
-- Each row stores the appointment response as it was created so repeats within 24 hours replay it.
-- Rows expire after 24 hours and are deleted lazily by the API.

create table idempotency_keys (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null,                                              -- profiles.user_id from the token; no foreign key: rows live 24 hours
    idempotency_key  uuid not null,
    appointment_id   uuid not null references appointments (id) on delete cascade,
    client_id        uuid not null,                                              -- request fingerprint
    service_id       uuid not null,                                              -- request fingerprint
    start_at         timestamptz not null,                                       -- request fingerprint
    end_at           timestamptz not null,                                       -- end as created, returned on replay
    created_at       timestamptz not null,                                       -- written by the API clock
    constraint idempotency_keys_user_key unique (user_id, idempotency_key),
    check (start_at < end_at)
);
create index idempotency_keys_created_at_idx on idempotency_keys (created_at);
