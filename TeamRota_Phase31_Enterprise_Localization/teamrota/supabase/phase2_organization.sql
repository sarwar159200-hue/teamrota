-- TEAMROTA PHASE 2: LIVE ORGANIZATION, EMPLOYEE DIRECTORY AND DASHBOARD
-- Run after schema.sql and admin_authority_upgrade.sql.

create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.divisions (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id) on delete set null,
  name text not null,
  code text unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete set null,
  name text not null,
  code text unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete set null,
  title text not null,
  code text unique,
  grade text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.departments add column if not exists division_id uuid references public.divisions(id) on delete set null;
alter table public.departments add column if not exists code text;
alter table public.departments add column if not exists description text;
alter table public.departments add column if not exists active boolean not null default true;

alter table public.profiles add column if not exists business_unit_id uuid references public.business_units(id) on delete set null;
alter table public.profiles add column if not exists division_id uuid references public.divisions(id) on delete set null;
alter table public.profiles add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.profiles add column if not exists position_id uuid references public.positions(id) on delete set null;
alter table public.profiles add column if not exists office_location text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists emergency_contact text;
alter table public.profiles add column if not exists rotation_pattern text default 'Office Based';
alter table public.profiles add column if not exists last_login_at timestamptz;

create index if not exists profiles_manager_idx on public.profiles(manager_id);
create index if not exists profiles_department_idx on public.profiles(department_id);
create index if not exists profiles_position_idx on public.profiles(position_id);

alter table public.business_units enable row level security;
alter table public.divisions enable row level security;
alter table public.teams enable row level security;
alter table public.positions enable row level security;

drop policy if exists "authenticated view business units" on public.business_units;
drop policy if exists "authenticated view divisions" on public.divisions;
drop policy if exists "authenticated view teams" on public.teams;
drop policy if exists "authenticated view positions" on public.positions;
drop policy if exists "admin manage business units" on public.business_units;
drop policy if exists "admin manage divisions" on public.divisions;
drop policy if exists "admin manage teams" on public.teams;
drop policy if exists "admin manage positions" on public.positions;

create policy "authenticated view business units" on public.business_units for select to authenticated using (true);
create policy "authenticated view divisions" on public.divisions for select to authenticated using (true);
create policy "authenticated view teams" on public.teams for select to authenticated using (true);
create policy "authenticated view positions" on public.positions for select to authenticated using (true);

create policy "admin manage business units" on public.business_units for all to authenticated
using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "admin manage divisions" on public.divisions for all to authenticated
using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "admin manage teams" on public.teams for all to authenticated
using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "admin manage positions" on public.positions for all to authenticated
using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- All authenticated employees may view non-sensitive organization directory details.
drop policy if exists "profile visibility" on public.profiles;
create policy "organization directory visibility" on public.profiles for select to authenticated
using (employment_status = 'active' or id = auth.uid() or public.current_user_role() in ('hr','admin'));

create or replace view public.employee_directory as
select
  p.id,
  p.employee_no,
  p.full_name,
  p.email,
  p.phone,
  p.photo_url,
  p.job_title,
  p.app_role,
  p.employment_status,
  p.office_location,
  p.rotation_pattern,
  p.joined_on,
  p.manager_id,
  p.leave_approver_id,
  d.name as department_name,
  bu.name as business_unit_name,
  dv.name as division_name,
  t.name as team_name,
  pos.title as position_title,
  m.full_name as manager_name
from public.profiles p
left join public.departments d on d.id = p.department_id
left join public.business_units bu on bu.id = p.business_unit_id
left join public.divisions dv on dv.id = p.division_id
left join public.teams t on t.id = p.team_id
left join public.positions pos on pos.id = p.position_id
left join public.profiles m on m.id = p.manager_id;

alter view public.employee_directory set (security_invoker = true);
grant select on public.employee_directory to authenticated;
