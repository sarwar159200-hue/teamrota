-- TeamRota Phase 18: Leave cleanup, auditability and performance
-- Safe to run more than once.

create table if not exists public.leave_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  original_leave_request_id uuid not null,
  employee_id uuid references public.profiles(id) on delete set null,
  employee_name text,
  employee_email text,
  leave_type_id uuid references public.leave_types(id) on delete set null,
  leave_type_name text,
  start_date date,
  end_date date,
  requested_days numeric(8,2),
  previous_status text,
  reason text,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_reason text not null,
  record_snapshot jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

create index if not exists leave_deletion_audit_deleted_at_idx
  on public.leave_deletion_audit(deleted_at desc);
create index if not exists leave_deletion_audit_employee_idx
  on public.leave_deletion_audit(employee_id, deleted_at desc);

alter table public.leave_deletion_audit enable row level security;

drop policy if exists leave_deletion_audit_admin_select on public.leave_deletion_audit;
create policy leave_deletion_audit_admin_select
on public.leave_deletion_audit for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(p.app_role::text) = 'admin'
  )
);

-- High-impact indexes for leave, rota, timesheet and dashboard queries.
create index if not exists leave_requests_employee_created_idx
  on public.leave_requests(employee_id, created_at desc);
create index if not exists leave_requests_approver_status_idx
  on public.leave_requests(approver_id, status, created_at desc);
create index if not exists leave_requests_department_head_status_idx
  on public.leave_requests(department_head_id, status, created_at desc);
create index if not exists leave_requests_status_dates_idx
  on public.leave_requests(status, start_date, end_date);
create index if not exists leave_requests_employee_type_year_idx
  on public.leave_requests(employee_id, leave_type_id, start_date, status);
create index if not exists leave_balances_employee_year_idx
  on public.leave_balances(employee_id, leave_year, leave_type_id);
create index if not exists rota_assignments_employee_date_idx
  on public.rota_assignments(employee_id, work_date);
create index if not exists holidays_active_date_idx
  on public.holidays(active, holiday_date);
create index if not exists employee_rotations_employee_active_dates_idx
  on public.employee_rotations(employee_id, active, effective_from, effective_to);
create index if not exists profiles_status_manager_idx
  on public.profiles(employment_status, manager_id);

analyze public.leave_requests;
analyze public.leave_balances;
analyze public.rota_assignments;
analyze public.holidays;
analyze public.employee_rotations;
analyze public.profiles;
