-- Staff may read the logs in the apps; only the API (database owner) writes them.

do $$
declare t text;
begin
    foreach t in array array['events', 'ai_runs', 'webhook_logs']
    loop
        execute format('alter table %I enable row level security', t);
        execute format('create policy staff_read on %I for select using (is_staff())', t);
    end loop;
end $$;
