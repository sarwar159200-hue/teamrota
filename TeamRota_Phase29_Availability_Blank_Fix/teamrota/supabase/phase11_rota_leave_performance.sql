-- TEAMROTA PHASE 11: LEAVE VALIDATION, ANNUAL ROTA AND PERFORMANCE
-- Run once after the earlier migrations. All statements are idempotent.

-- Public holidays remain in the holiday calendar but are not requestable leave.
update public.leave_types
set policy_notes = 'Managed through the governmental/company holiday calendar; employees cannot submit this as leave.'
where code = 'PH';

-- Query indexes used by leave validation, annual rota and dashboards.
create index if not exists leave_requests_employee_status_dates_idx
  on public.leave_requests(employee_id, status, start_date, end_date);
create index if not exists leave_requests_employee_type_status_start_idx
  on public.leave_requests(employee_id, leave_type_id, status, start_date);
create index if not exists leave_balances_employee_type_year_idx
  on public.leave_balances(employee_id, leave_type_id, leave_year);
create index if not exists rota_assignments_employee_date_idx
  on public.rota_assignments(employee_id, work_date);
create index if not exists employee_rotations_employee_active_dates_idx
  on public.employee_rotations(employee_id, active, effective_from, effective_to);
create index if not exists holidays_active_date_scope_idx
  on public.holidays(active, holiday_date, department_id);
create index if not exists profiles_manager_active_idx
  on public.profiles(manager_id, employment_status);

-- Prevent duplicate active/pending leave periods at database level through a trigger.
create or replace function public.prevent_overlapping_leave_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('pending', 'approved') and exists (
    select 1
    from public.leave_requests existing
    where existing.employee_id = new.employee_id
      and existing.id <> coalesce(new.id, gen_random_uuid())
      and existing.status in ('pending', 'approved')
      and existing.start_date <= new.end_date
      and existing.end_date >= new.start_date
  ) then
    raise exception 'This leave period overlaps another pending or approved request.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_overlapping_leave_requests_trigger
  on public.leave_requests;
create trigger prevent_overlapping_leave_requests_trigger
before insert or update of start_date, end_date, status
on public.leave_requests
for each row execute function public.prevent_overlapping_leave_requests();
