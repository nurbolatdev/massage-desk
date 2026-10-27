-- Supabase-only additions (profile "supabase"): link staff to Supabase Auth,
-- row level security for the apps, realtime for the live schedule and chats.
-- The API connects as the database owner and is not limited by these policies.

alter table profiles
    add constraint profiles_user_fk foreign key (user_id) references auth.users (id) on delete cascade;

create function is_staff() returns boolean
    language sql stable security definer set search_path = public as $$
    select exists (select 1 from profiles where user_id = auth.uid())
$$;

do $$
declare t text;
begin
    foreach t in array array['clients', 'services', 'working_hours', 'time_off', 'appointments',
                             'conversations', 'messages', 'profiles', 'devices', 'settings']
    loop
        execute format('alter table %I enable row level security', t);
        execute format('create policy staff_all on %I for all using (is_staff()) with check (is_staff())', t);
    end loop;
end $$;

alter publication supabase_realtime add table appointments, messages, conversations;
