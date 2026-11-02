-- Schedule constraints (portable PostgreSQL, also applied on Supabase).
-- Staff may write these tables directly through Supabase policies, so the database
-- itself refuses malformed rows. The API validates first and answers with 400/422.

-- phones are stored in E.164
alter table clients
    add constraint clients_phone_e164 check (phone ~ '^\+[0-9]{9,15}$');

-- every time off period is a finite half-open range [start, end)
alter table time_off
    add constraint time_off_period_bounded check (
        not isempty(period)
        and not lower_inf(period)
        and not upper_inf(period)
        and lower_inc(period)
        and not upper_inc(period));

-- blocks of one day must neither overlap nor touch
alter table working_hours
    add constraint working_hours_no_overlap
    -- each weekday maps to its own date (two days apart) so days never compare; '[]' makes touching blocks conflict
    exclude using gist (
        tsrange(
            (date '2000-01-01' + 2 * weekday) + start_time,
            (date '2000-01-01' + 2 * weekday) + end_time,
            '[]') with &&);
