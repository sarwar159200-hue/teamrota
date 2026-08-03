-- TeamRota Phase 12 Revision 2
-- HR rota authority, join dates, monthly timesheets and corrected RLS policies.
-- This script is safe to rerun after a partial Phase 12 execution.

alter table public.profiles
  add column if not exists join_date date;

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  timesheet_year integer not null,
  timesheet_month integer not null check (timesheet_month between 1 and 12),
  status text not null default 'draft'
    check (status in (
      'draft',
      'submitted',
      'manager_approved',
      'manager_rejected',
      'hr_done',
      'sent_payroll'
    )),
  manager_id uuid references public.profiles(id),
  submitted_at timestamptz,
  manager_decided_by uuid references public.profiles(id),
  manager_decided_at timestamptz,
  manager_comment text,
  hr_completed_by uuid references public.profiles(id),
  hr_completed_at timestamptz,
  payroll_sent_by uuid references public.profiles(id),
  payroll_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, timesheet_year, timesheet_month)
);

create table if not exists public.timesheet_notification_log (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid references public.timesheets(id) on delete cascade,
  event_type text not null,
  recipients text[] not null default '{}',
  delivery_status text not null,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_timesheets_employee_period
  on public.timesheets(employee_id, timesheet_year, timesheet_month);
create index if not exists idx_timesheets_status
  on public.timesheets(status);
create index if not exists idx_profiles_manager_active
  on public.profiles(manager_id, employment_status);
create index if not exists idx_rota_assignments_employee_date
  on public.rota_assignments(employee_id, work_date);
create index if not exists idx_leave_requests_employee_dates
  on public.leave_requests(employee_id, start_date, end_date, status);
create index if not exists idx_overtime_employee_date_status
  on public.overtime_requests(employee_id, overtime_date, status);

alter table public.timesheets enable row level security;
alter table public.timesheet_notification_log enable row level security;

drop policy if exists timesheets_select on public.timesheets;
create policy timesheets_select
on public.timesheets
for select
to authenticated
using (
  employee_id = auth.uid()
  or manager_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.app_role::text) in ('admin', 'hr')
  )
);

drop policy if exists timesheets_insert on public.timesheets;
create policy timesheets_insert
on public.timesheets
for insert
to authenticated
with check (
  employee_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.app_role::text) in ('admin', 'hr')
  )
);

drop policy if exists timesheets_update on public.timesheets;
create policy timesheets_update
on public.timesheets
for update
to authenticated
using (
  employee_id = auth.uid()
  or manager_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.app_role::text) in ('admin', 'hr')
  )
)
with check (true);

drop policy if exists timesheet_log_select
  on public.timesheet_notification_log;
create policy timesheet_log_select
on public.timesheet_notification_log
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.app_role::text) in ('admin', 'hr')
  )
);
