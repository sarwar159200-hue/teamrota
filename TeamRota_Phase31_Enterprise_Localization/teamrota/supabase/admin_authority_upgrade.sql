-- Run after schema.sql

do $$ begin
  create type public.leave_status as enum ('pending','approved','rejected','cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  leave_type_id uuid references public.leave_types(id),
  start_date date not null,
  end_date date not null,
  requested_days numeric(6,2) not null default 1,
  reason text,
  medical_document_path text,
  status public.leave_status not null default 'pending',
  approver_id uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.rota_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  status_code text not null,
  note text,
  updated_at timestamptz not null default now(),
  unique(employee_id, work_date)
);

alter table public.leave_requests enable row level security;
alter table public.rota_assignments enable row level security;

-- Remove the original broad self-update policy so employees cannot change their own role.
drop policy if exists "self update limited profile" on public.profiles;

drop policy if exists "admin full profile control" on public.profiles;
create policy "admin full profile control"
on public.profiles for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "leave visibility" on public.leave_requests;
create policy "leave visibility"
on public.leave_requests for select to authenticated
using (
  employee_id = auth.uid()
  or approver_id = auth.uid()
  or public.current_user_role() in ('hr','admin')
  or public.is_manager_of(employee_id)
);

drop policy if exists "employee submit own leave" on public.leave_requests;
create policy "employee submit own leave"
on public.leave_requests for insert to authenticated
with check (employee_id = auth.uid());

drop policy if exists "admin full leave control" on public.leave_requests;
create policy "admin full leave control"
on public.leave_requests for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "manager hr update leave" on public.leave_requests;
create policy "manager hr update leave"
on public.leave_requests for update to authenticated
using (
  public.current_user_role() in ('hr','admin')
  or approver_id = auth.uid()
  or public.is_manager_of(employee_id)
)
with check (
  public.current_user_role() in ('hr','admin')
  or approver_id = auth.uid()
  or public.is_manager_of(employee_id)
);

drop policy if exists "rota visibility" on public.rota_assignments;
create policy "rota visibility"
on public.rota_assignments for select to authenticated
using (
  employee_id = auth.uid()
  or public.current_user_role() in ('manager','hr','admin')
);

drop policy if exists "admin full rota control" on public.rota_assignments;
create policy "admin full rota control"
on public.rota_assignments for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

update public.profiles
set app_role = 'admin',
    job_title = coalesce(job_title, 'System Administrator'),
    employment_status = 'active'
where lower(email) = lower('Sarwar.khalid@miranenergy.com');
