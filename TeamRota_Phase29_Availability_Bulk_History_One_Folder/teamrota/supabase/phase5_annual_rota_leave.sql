-- TEAMROTA PHASE 5: ANNUAL ROTA, LEAVE POLICIES, BALANCES AND NOTIFICATION SUPPORT
-- Run after phase4_overtime.sql.

alter table public.profiles
  add column if not exists gender text check (gender in ('female','male','other','not_specified')) default 'not_specified',
  add column if not exists maternity_return_date date;

alter table public.leave_types
  add column if not exists day_basis text not null default 'working' check (day_basis in ('working','calendar')),
  add column if not exists carry_forward boolean not null default false,
  add column if not exists eligibility_gender text,
  add column if not exists entitlement_unit text not null default 'days' check (entitlement_unit in ('days','hours')),
  add column if not exists policy_notes text;

alter table public.leave_balances
  add column if not exists carried_forward numeric(8,2) not null default 0;

alter table public.leave_requests
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists decision_comment text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.annual_rota_batches (
  id uuid primary key default gen_random_uuid(),
  rota_year integer not null check (rota_year between 2020 and 2100),
  name text not null,
  employee_scope text not null default 'all' check (employee_scope in ('all','selected')),
  selected_employee_ids uuid[] not null default '{}',
  working_weekdays integer[] not null default '{0,1,2,3,4}',
  off_weekdays integer[] not null default '{5,6}',
  work_status_code text not null default 'D',
  off_status_code text not null default 'R',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.annual_rota_batches enable row level security;
drop policy if exists "annual rota batch visibility" on public.annual_rota_batches;
create policy "annual rota batch visibility" on public.annual_rota_batches for select to authenticated using (true);
drop policy if exists "hr admin manage annual rota batches" on public.annual_rota_batches;
create policy "hr admin manage annual rota batches" on public.annual_rota_batches for all to authenticated
using (public.current_user_role() in ('hr','admin')) with check (public.current_user_role() in ('hr','admin'));

grant select, insert, update, delete on public.annual_rota_batches to authenticated;

insert into public.leave_types
(name, code, annual_allowance, deducts_balance, requires_document, active, day_basis, carry_forward, eligibility_gender, entitlement_unit, policy_notes)
values
('Annual Leave','AL',20,true,false,true,'working',false,null,'days','Default entitlement: 20 working days per year.'),
('Sick Leave','SL',30,true,true,true,'calendar',true,null,'days','30 calendar days per year. Unused balance carries forward.'),
('Marriage Leave','ML',5,true,false,true,'calendar',false,null,'days','5 calendar days.'),
('Maternity Leave','MAT',72,true,true,true,'calendar',false,'female','days','72 calendar days for eligible female employees.'),
('Nursing Break','NB',365,true,false,true,'working',false,'female','hours','1 hour per working day for one year after maternity leave.'),
('Paternity Leave','PAT',3,true,false,true,'calendar',false,'male','days','3 calendar days.'),
('Bereavement Leave','BL',3,true,false,true,'calendar',false,null,'days','3 calendar days for an immediate family member.'),
('Public Holiday','PH',0,false,false,true,'calendar',false,null,'days','Managed through the governmental/company holiday calendar.'),
('Unpaid Leave','UL',0,false,false,true,'calendar',false,null,'days','Unpaid leave; no balance deduction.')
on conflict (code) do update set
  name=excluded.name,
  annual_allowance=excluded.annual_allowance,
  deducts_balance=excluded.deducts_balance,
  requires_document=excluded.requires_document,
  active=true,
  day_basis=excluded.day_basis,
  carry_forward=excluded.carry_forward,
  eligibility_gender=excluded.eligibility_gender,
  entitlement_unit=excluded.entitlement_unit,
  policy_notes=excluded.policy_notes;

create or replace function public.ensure_employee_leave_balances(target_year integer)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.leave_balances(employee_id,leave_type_id,leave_year,entitled,used,adjustment,carried_forward)
  select p.id, lt.id, target_year, lt.annual_allowance, 0, 0,
    case when lt.carry_forward then coalesce(prev.entitled + prev.adjustment + prev.carried_forward - prev.used,0) else 0 end
  from public.profiles p
  cross join public.leave_types lt
  left join public.leave_balances prev on prev.employee_id=p.id and prev.leave_type_id=lt.id and prev.leave_year=target_year-1
  where p.employment_status='active' and lt.active=true
    and (lt.eligibility_gender is null or lt.eligibility_gender=p.gender)
  on conflict (employee_id,leave_type_id,leave_year) do update set
    entitled=excluded.entitled,
    carried_forward=excluded.carried_forward;
end; $$;

select public.ensure_employee_leave_balances(extract(year from current_date)::integer);
select public.ensure_employee_leave_balances(extract(year from current_date)::integer + 1);
