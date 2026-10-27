-- massage desk: core schema (portable PostgreSQL, used locally, in tests and on Supabase).
-- All timestamps are timestamptz (UTC); apps show them in settings.time_zone.

create extension if not exists btree_gist;

create table clients (
    id          uuid primary key default gen_random_uuid(),
    phone       text unique not null,          -- E.164, e.g. +998901234567
    name        text,
    notes       text,
    created_at  timestamptz not null default now()
);

create table services (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    duration_min  int not null check (duration_min > 0),
    price         numeric(12, 2) not null check (price >= 0),
    active        boolean not null default true,
    sort_order    int not null default 0
);

-- weekday: 1 = Monday … 7 = Sunday (ISO, matches java.time.DayOfWeek).
-- Several rows per day = working blocks around a break.
create table working_hours (
    id          uuid primary key default gen_random_uuid(),
    weekday     int not null check (weekday between 1 and 7),
    start_time  time not null,
    end_time    time not null,
    check (start_time < end_time)
);

create table time_off (
    id      uuid primary key default gen_random_uuid(),
    period  tstzrange not null,
    reason  text
);

create table appointments (
    id                uuid primary key default gen_random_uuid(),
    client_id         uuid not null references clients (id),
    service_id        uuid not null references services (id),
    period            tstzrange not null,
    status            text not null default 'confirmed'
                      check (status in ('confirmed', 'cancelled', 'no_show', 'done')),
    source            text not null default 'bot' check (source in ('bot', 'manual')),
    reminder_sent_at  timestamptz,
    created_at        timestamptz not null default now(),
    -- the database itself refuses two confirmed appointments at overlapping times
    constraint appointments_no_overlap
        exclude using gist (period with &&) where (status = 'confirmed')
);
create index appointments_period_idx on appointments using gist (period);

create table conversations (
    id               uuid primary key default gen_random_uuid(),
    client_id        uuid not null unique references clients (id),
    human_mode       boolean not null default false,   -- the master answers, the bot stays silent
    needs_attention  boolean not null default false,   -- the bot asked the master for help
    last_inbound_at  timestamptz,                      -- start of the 24h WhatsApp window
    last_message_at  timestamptz
);

create table messages (
    id               uuid primary key default gen_random_uuid(),
    conversation_id  uuid not null references conversations (id),
    direction        text not null check (direction in ('in', 'out')),
    author           text not null check (author in ('client', 'bot', 'master')),
    body             text,
    wa_message_id    text unique,
    created_at       timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, created_at);

-- Staff accounts. user_id is the auth provider's user id (Supabase Auth);
-- the foreign key to auth.users is added by the Supabase-only migration.
create table profiles (
    user_id       uuid primary key,
    role          text not null check (role in ('master', 'admin')),
    display_name  text
);

create table devices (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references profiles (user_id) on delete cascade,
    expo_push_token  text unique not null,
    created_at       timestamptz not null default now()
);

create table settings (
    id           boolean primary key default true check (id),   -- single row
    time_zone    text not null default 'Asia/Tashkent',
    address      text,
    bot_enabled  boolean not null default true
);
insert into settings default values;
