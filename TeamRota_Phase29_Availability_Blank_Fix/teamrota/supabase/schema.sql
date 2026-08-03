-- TEAMROTA PHASE 1 DATABASE
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('employee', 'manager', 'hr', 'admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_no text unique,
  email text,
  full_name text,
  phone text,
  job_title text,
  photo_url text,
  app_role public.app_role not null default 'employee',
  department_id uuid references public.departments(id),
  manager_id uuid references public.profiles(id),
  leave_approver_id uuid references public.profiles(id),
  employment_status text not null default 'active'
    check (employment_status in ('active','inactive')),
  joined_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  annual_allowance numeric(6,2) not null default 0,
  deducts_balance boolean not null default true,
  requires_document boolean not null default false,
  active boolean not null default true
);

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id),
  leave_year integer not null,
  entitled numeric(6,2) not null default 0,
  used numeric(6,2) not null default 0,
  adjustment numeric(6,2) not null default 0,
  unique(employee_id, leave_type_id, leave_year)
);

create table if not exists public.delegations (
  id uuid primary key default gen_random_uuid(),
  delegator_id uuid not null references public.profiles(id),
  delegate_id uuid not null references public.profiles(id),
  starts_on date not null,
  ends_on date not null,
  scope text not null default 'leave_approval',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (delegator_id <> delegate_id)
);

create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select app_role from public.profiles where id = auth.uid()),
    'employee'::public.app_role
  );
$$;

create or replace function public.is_manager_of(target_employee uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_employee
      and (p.manager_id = auth.uid() or p.leave_approver_id = auth.uid())
  );
$$;

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_balances enable row level security;
alter table public.delegations enable row level security;

drop policy if exists "authenticated read departments" on public.departments;
create policy "authenticated read departments"
on public.departments for select to authenticated using (true);

drop policy if exists "admin manage departments" on public.departments;
create policy "admin manage departments"
on public.departments for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "profile visibility" on public.profiles;
create policy "profile visibility"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.current_user_role() in ('hr','admin')
  or public.is_manager_of(id)
);

drop policy if exists "self update limited profile" on public.profiles;
create policy "self update limited profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles"
on public.profiles for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "authenticated read leave types" on public.leave_types;
create policy "authenticated read leave types"
on public.leave_types for select to authenticated using (active = true);

drop policy if exists "admin manage leave types" on public.leave_types;
create policy "admin manage leave types"
on public.leave_types for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "balance visibility" on public.leave_balances;
create policy "balance visibility"
on public.leave_balances for select to authenticated
using (
  employee_id = auth.uid()
  or public.current_user_role() in ('hr','admin')
  or public.is_manager_of(employee_id)
);

drop policy if exists "hr admin manage balances" on public.leave_balances;
create policy "hr admin manage balances"
on public.leave_balances for all to authenticated
using (public.current_user_role() in ('hr','admin'))
with check (public.current_user_role() in ('hr','admin'));

drop policy if exists "delegation visibility" on public.delegations;
create policy "delegation visibility"
on public.delegations for select to authenticated
using (
  delegator_id = auth.uid()
  or delegate_id = auth.uid()
  or public.current_user_role() in ('hr','admin')
);

drop policy if exists "manager create own delegation" on public.delegations;
create policy "manager create own delegation"
on public.delegations for insert to authenticated
with check (
  delegator_id = auth.uid()
  and public.current_user_role() in ('manager','hr','admin')
);

drop policy if exists "manager update own delegation" on public.delegations;
create policy "manager update own delegation"
on public.delegations for update to authenticated
using (
  delegator_id = auth.uid()
  or public.current_user_role() = 'admin'
)
with check (
  delegator_id = auth.uid()
  or public.current_user_role() = 'admin'
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.leave_types (name, code, annual_allowance, deducts_balance, requires_document)
values
  ('Annual Leave', 'AL', 24, true, false),
  ('Sick Leave', 'SL', 10, true, true),
  ('Unpaid Leave', 'UL', 0, false, false)
on conflict (code) do nothing;
