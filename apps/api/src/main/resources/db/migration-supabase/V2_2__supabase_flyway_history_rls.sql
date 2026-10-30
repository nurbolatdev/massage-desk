-- No policies on purpose: the REST API (anon/authenticated) cannot read or change the
-- migration history. Flyway connects as the table owner and is not affected.

alter table flyway_schema_history enable row level security;
