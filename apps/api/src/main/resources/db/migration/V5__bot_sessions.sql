-- One row per conversation: where the client is in the button booking flow; written only by the API.
-- No foreign keys to services or appointments: domain services re-check ids on every use,
-- and foreign keys would block deleting appointments in tests.

create table bot_sessions (
    conversation_id  uuid primary key references conversations (id) on delete cascade,
    step             text not null check (step in ('menu', 'service', 'day', 'time', 'confirm',
                                                   'move_pick', 'cancel_pick', 'cancel_confirm')),
    service_id       uuid,
    day              date,                      -- local day in settings.time_zone
    start_at         timestamptz,
    appointment_id   uuid,                      -- appointment being rescheduled or cancelled
    updated_at       timestamptz not null       -- written by the API clock; older than 24h restarts from menu
);
