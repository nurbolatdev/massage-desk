-- Development seed (profile "seed"): placeholder services and working hours so the
-- schedule has something to show. Real values come from the master.
-- Repeatable and idempotent: runs after all versioned migrations, never duplicates rows.

insert into services (name, duration_min, price, sort_order)
select v.name, v.duration_min, v.price, v.sort_order
from (values
    ('Классический массаж', 60, 150000, 1),
    ('Массаж спины',        30,  90000, 2),
    ('Массаж всего тела',   90, 220000, 3)
) as v (name, duration_min, price, sort_order)
where not exists (select 1 from services s where s.name = v.name);

-- Monday to Saturday, 10:00-14:00 and 15:00-19:00 (a break between the blocks).
insert into working_hours (weekday, start_time, end_time)
select d, b.start_time, b.end_time
from generate_series(1, 6) as d,
     (values ('10:00'::time, '14:00'::time), ('15:00'::time, '19:00'::time)) as b (start_time, end_time)
where not exists (select 1 from working_hours);
