-- TeamRota Phase 15
-- Arabic language support is application-side.
-- This migration adds secure secondary (dotted-line) reporting relationships.

create table if not exists public.employee_reporting_lines (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  relationship_type text not null default 'dotted' check (relationship_type in ('dotted')),
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_reporting_lines_not_self check (employee_id <> manager_id),
  constraint employee_reporting_lines_unique unique (employee_id, manager_id, relationship_type)
);

create index if not exists employee_reporting_lines_employee_idx
  on public.employee_reporting_lines(employee_id) where active = true;

create index if not exists employee_reporting_lines_manager_idx
  on public.employee_reporting_lines(manager_id) where active = true;

alter table public.employee_reporting_lines enable row level security;

drop policy if exists employee_reporting_lines_select on public.employee_reporting_lines;
create policy employee_reporting_lines_select
on public.employee_reporting_lines
for select
to authenticated
using (true);

drop policy if exists employee_reporting_lines_manage on public.employee_reporting_lines;
create policy employee_reporting_lines_manage
on public.employee_reporting_lines
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.app_role::text) in ('admin', 'hr')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.app_role::text) in ('admin', 'hr')
  )
);
