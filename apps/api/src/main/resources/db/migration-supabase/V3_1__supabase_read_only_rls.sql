-- Staff read the business tables through Supabase (the apps, realtime).
-- Every write goes through the API, which owns the tables and is not limited by row level security.
-- There are no insert/update/delete policies on purpose: such statements are refused or change nothing.

-- Same body as before; the search path now ends with pg_temp so a temporary table cannot shadow profiles.
create or replace function is_staff() returns boolean
    language sql stable security definer set search_path = public, pg_temp as $$
    select exists (select 1 from public.profiles where user_id = auth.uid())
$$;

do $$
declare t text;
begin
    foreach t in array array['clients', 'services', 'working_hours', 'time_off', 'appointments',
                             'conversations', 'messages', 'devices', 'settings']
    loop
        execute format('drop policy staff_all on %I', t);
        execute format('create policy staff_read on %I for select to authenticated using (is_staff())', t);
    end loop;

    foreach t in array array['events', 'ai_runs', 'webhook_logs']
    loop
        execute format('drop policy staff_read on %I', t);
        execute format('create policy staff_read on %I for select to authenticated using (is_staff())', t);
    end loop;
end $$;

-- A staff member sees only their own profile; the API reads profiles as the owner.
drop policy staff_all on profiles;
create policy own_profile_read on profiles for select to authenticated using (user_id = auth.uid());
