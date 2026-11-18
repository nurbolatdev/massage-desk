-- A minimal stand-in for the Supabase objects our migrations and policies use.
-- It is not a copy of Supabase: roles, the auth schema, the realtime publication
-- and the owner role are modelled only as far as the policy tests need.
-- Run as the database superuser before Flyway.

create extension if not exists btree_gist;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- the API's database user: owns every table, not a superuser, not subject to bypassrls
create role api_owner login password 'api_owner';

create schema auth;
create table auth.users (id uuid primary key);

-- as defined in Supabase: the user id comes from the request's JWT claims
create function auth.uid() returns uuid
    language sql stable as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

create publication supabase_realtime;
alter publication supabase_realtime owner to api_owner;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to api_owner;
grant create on schema public to api_owner;
grant usage on schema auth to api_owner;
grant references on auth.users to api_owner;

do $$
begin
    execute format('grant create on database %I to api_owner', current_database());
end $$;

-- Supabase grants everything on new tables to its API roles; row level security is the only guard
alter default privileges for role api_owner in schema public
    grant all on tables to anon, authenticated, service_role;
alter default privileges for role api_owner in schema public
    grant all on sequences to anon, authenticated, service_role;
alter default privileges for role api_owner in schema public
    grant all on functions to anon, authenticated, service_role;
