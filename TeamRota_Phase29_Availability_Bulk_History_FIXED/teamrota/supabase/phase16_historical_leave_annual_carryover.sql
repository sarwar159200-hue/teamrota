-- TEAMROTA PHASE 16: HISTORICAL LEAVE + ANNUAL LEAVE CARRY-FORWARD
-- Run after Phase 15. Safe to run more than once.

alter table public.leave_balances
  add column if not exists carried_forward_expires_on date;

-- Annual Leave: maximum 5 unused days move to the following year and expire on 31 May.
update public.leave_types
set carry_forward = true,
    policy_notes = 'Maximum 5 unused working days carry to the next year and expire at the end of May.'
where code = 'AL';

create or replace function public.ensure_employee_leave_balances(target_year integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leave_balances(
    employee_id, leave_type_id, leave_year, entitled, used, adjustment,
    carried_forward, carried_forward_expires_on
  )
  select
    p.id,
    lt.id,
    target_year,
    lt.annual_allowance,
    0,
    0,
    case
      when lt.code = 'AL' then least(
        5,
        greatest(coalesce(prev.entitled + prev.adjustment + prev.carried_forward - prev.used, 0), 0)
      )
      when lt.carry_forward then greatest(
        coalesce(prev.entitled + prev.adjustment + prev.carried_forward - prev.used, 0), 0
      )
      else 0
    end,
    case
      when lt.code = 'AL' then make_date(target_year, 5, 31)
      else null
    end
  from public.profiles p
  cross join public.leave_types lt
  left join public.leave_balances prev
    on prev.employee_id = p.id
   and prev.leave_type_id = lt.id
   and prev.leave_year = target_year - 1
  where p.employment_status = 'active'
    and lt.active = true
    and (lt.eligibility_gender is null or lt.eligibility_gender = p.gender)
  on conflict (employee_id, leave_type_id, leave_year)
  do update set
    entitled = excluded.entitled,
    carried_forward = excluded.carried_forward,
    carried_forward_expires_on = excluded.carried_forward_expires_on;
end;
$$;

-- Refresh current and next-year balances using the new policy.
select public.ensure_employee_leave_balances(extract(year from current_date)::integer);
select public.ensure_employee_leave_balances(extract(year from current_date)::integer + 1);

create index if not exists leave_balances_carry_expiry_idx
  on public.leave_balances(employee_id, leave_year, carried_forward_expires_on);
