-- Only the API (table owner) reads and writes bot sessions; staff get no policy on purpose.

alter table bot_sessions enable row level security;
