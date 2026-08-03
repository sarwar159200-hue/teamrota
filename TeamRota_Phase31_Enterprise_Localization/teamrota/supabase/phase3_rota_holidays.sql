-- TEAMROTA PHASE 3: ROTATION, ROTA, HOLIDAYS AND ADMIN EMAIL CONTROL
-- Run after phase2_organization.sql.

create table if not exists public.rotation_patterns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  rotation_type text not null default 'cyclic'
    check (rotation_type in ('cyclic','office','remote','site','custom')),
  days_on integer not null default 0 check (days_on >= 0),
  days_off integer not null default 0 check (days_off >= 0),
  default_shift_code text not null default 'D',
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_rotations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  rotation_pattern_id uuid not null references public.rotation_patterns(id),
  effective_from date not null,
  effective_to date,
  cycle_anchor_date date not null,
  start_status text not null default 'ON' check (start_status in ('ON','OFF')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique(employee_id, effective_from)
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null,
  holiday_type text not null default 'public'
    check (holiday_type in ('public','company','department','location')),
  department_id uuid references public.departments(id) on delete set null,
  office_location text,
  paid boolean not null default true,
  recurring_annually boolean not null default false,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(name, holiday_date, department_id, office_location)
);

-- Extend the existing rota_assignments table created in Phase 1.
alter table public.rota_assignments add column if not exists shift_start time;
alter table public.rota_assignments add column if not exists shift_end time;
alter table public.rota_assignments add column if not exists source text not null default 'manual';
alter table public.rota_assignments add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create index if not exists rotation_pattern_active_idx on public.rotation_patterns(active);
create index if not exists employee_rotations_employee_idx on public.employee_rotations(employee_id, effective_from);
create index if not exists holidays_date_idx on public.holidays(holiday_date);
create index if not exists rota_assignment_date_idx on public.rota_assignments(work_date);

alter table public.rotation_patterns enable row level security;
alter table public.employee_rotations enable row level security;
alter table public.holidays enable row level security;

-- Remove old broad rota policies and replace with role-aware policies.
drop policy if exists "rota visibility" on public.rota_assignments;
drop policy if exists "admin full rota control" on public.rota_assignments;

drop policy if exists "rotation patterns visible" on public.rotation_patterns;
drop policy if exists "admin manage rotation patterns" on public.rotation_patterns;
drop policy if exists "employee rotation visibility" on public.employee_rotations;
drop policy if exists "admin manage employee rotations" on public.employee_rotations;
drop policy if exists "holiday visibility" on public.holidays;
drop policy if exists "admin hr manage holidays" on public.holidays;

create policy "rotation patterns visible" on public.rotation_patterns
for select to authenticated using (active = true or public.current_user_role() in ('hr','admin'));

create policy "admin manage rotation patterns" on public.rotation_patterns
for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "employee rotation visibility" on public.employee_rotations
for select to authenticated using (
  employee_id = auth.uid()
  or public.current_user_role() in ('hr','admin')
  or public.is_manager_of(employee_id)
);

create policy "admin manage employee rotations" on public.employee_rotations
for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "holiday visibility" on public.holidays
for select to authenticated using (
  active = true
  and (
    department_id is null
    or department_id = (select department_id from public.profiles where id = auth.uid())
    or public.current_user_role() in ('hr','admin')
  )
);

create policy "admin hr manage holidays" on public.holidays
for all to authenticated
using (public.current_user_role() in ('hr','admin'))
with check (public.current_user_role() in ('hr','admin'));

create policy "rota role visibility" on public.rota_assignments
for select to authenticated using (
  employee_id = auth.uid()
  or public.current_user_role() in ('hr','admin')
  or public.is_manager_of(employee_id)
);

create policy "admin manage all rota" on public.rota_assignments
for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- Seed standard patterns.
insert into public.rotation_patterns (name, code, rotation_type, days_on, days_off, default_shift_code, description)
values
  ('Office Based', 'OFFICE', 'office', 5, 2, 'D', 'Standard office schedule'),
  ('14 Days ON / 14 Days OFF', '14-14', 'cyclic', 14, 14, 'D', 'Fourteen days working followed by fourteen rest days'),
  ('21 Days ON / 21 Days OFF', '21-21', 'cyclic', 21, 21, 'D', 'Twenty-one days working followed by twenty-one rest days'),
  ('28 Days ON / 28 Days OFF', '28-28', 'cyclic', 28, 28, 'D', 'Twenty-eight days working followed by twenty-eight rest days'),
  ('Remote', 'REMOTE', 'remote', 5, 2, 'WFH', 'Remote work schedule'),
  ('Site Based', 'SITE', 'site', 6, 1, 'D', 'Site-based six-day working week')
on conflict (name) do nothing;

-- Current rotation status helper.
create or replace function public.rotation_status_for_date(
  p_anchor date,
  p_days_on integer,
  p_days_off integer,
  p_date date
) returns text
language plpgsql immutable
as $$
declare
  cycle_length integer;
  day_index integer;
begin
  cycle_length := p_days_on + p_days_off;
  if cycle_length <= 0 then return 'D'; end if;
  day_index := mod((p_date - p_anchor), cycle_length);
  if day_index < 0 then day_index := day_index + cycle_length; end if;
  if day_index < p_days_on then return 'D'; else return 'R'; end if;
end;
$$;

grant execute on function public.rotation_status_for_date(date, integer, integer, date) to authenticated;
