-- TEAMROTA PHASE 26: AUTOMATIC LEAVE BALANCE PROVISIONING
-- Safe to run after Phase 25. Safe to run more than once.

-- Keep the existing balance function, but make sure current and future employees
-- receive balances automatically when their profile is created or activated.

create or replace function public.teamrota_provision_profile_leave_balances()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.employment_status, 'active') = 'active' then
    perform public.ensure_employee_leave_balances(extract(year from current_date)::integer);
    perform public.ensure_employee_leave_balances(extract(year from current_date)::integer + 1);
  end if;
  return new;
end;
$$;

drop trigger if exists teamrota_profile_leave_balance_provision on public.profiles;
create trigger teamrota_profile_leave_balance_provision
after insert or update of employment_status, gender
on public.profiles
for each row
execute function public.teamrota_provision_profile_leave_balances();

-- Rebuild balances when an active leave type is added or its entitlement changes.
create or replace function public.teamrota_refresh_balances_after_leave_type_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_employee_leave_balances(extract(year from current_date)::integer);
  perform public.ensure_employee_leave_balances(extract(year from current_date)::integer + 1);
  return new;
end;
$$;

drop trigger if exists teamrota_leave_type_balance_refresh on public.leave_types;
create trigger teamrota_leave_type_balance_refresh
after insert or update of active, annual_allowance, eligibility_gender, carry_forward
on public.leave_types
for each statement
execute function public.teamrota_refresh_balances_after_leave_type_change();

-- Repair all existing active employees now.
select public.ensure_employee_leave_balances(extract(year from current_date)::integer);
select public.ensure_employee_leave_balances(extract(year from current_date)::integer + 1);

create index if not exists leave_balances_employee_year_type_phase26_idx
  on public.leave_balances(employee_id, leave_year, leave_type_id);

analyze public.leave_balances;
