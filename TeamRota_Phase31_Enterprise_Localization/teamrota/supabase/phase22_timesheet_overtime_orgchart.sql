-- TeamRota Phase 22: overtime maintenance, timesheet workflow and performance indexes
create table if not exists public.overtime_change_audit (
  id uuid primary key default gen_random_uuid(),
  overtime_request_id uuid,
  action text not null check (action in ('updated','deleted')),
  changed_by uuid references public.profiles(id) on delete set null,
  old_record jsonb,
  new_record jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists overtime_requests_employee_date_idx
  on public.overtime_requests(employee_id, overtime_date);
create index if not exists overtime_requests_status_manager_idx
  on public.overtime_requests(status, line_manager_id, department_head_id);
create index if not exists timesheets_status_manager_idx
  on public.timesheets(status, manager_id, timesheet_year, timesheet_month);
create index if not exists profiles_active_manager_idx
  on public.profiles(employment_status, manager_id);

alter table public.overtime_change_audit enable row level security;
drop policy if exists overtime_change_audit_select on public.overtime_change_audit;
create policy overtime_change_audit_select on public.overtime_change_audit for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and lower(p.app_role::text) in ('admin','hr'))
);
