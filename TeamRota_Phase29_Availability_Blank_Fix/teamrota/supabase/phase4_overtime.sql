-- TEAMROTA PHASE 4: OVERTIME REQUESTS, APPROVALS AND EMAIL NOTIFICATION LOGS
-- Run after phase3_rota_holidays.sql.

alter table public.departments
  add column if not exists head_id uuid references public.profiles(id) on delete set null;

create table if not exists public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  overtime_date date not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0 check (break_minutes >= 0 and break_minutes <= 720),
  requested_hours numeric(6,2) not null check (requested_hours > 0 and requested_hours <= 24),
  justification text not null check (char_length(trim(justification)) >= 5),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  line_manager_id uuid references public.profiles(id) on delete set null,
  department_head_id uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_comment text,
  hr_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.overtime_notification_log (
  id uuid primary key default gen_random_uuid(),
  overtime_request_id uuid not null references public.overtime_requests(id) on delete cascade,
  notification_type text not null,
  recipients text[] not null default '{}',
  delivery_status text not null default 'queued'
    check (delivery_status in ('queued','sent','failed','skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists overtime_employee_idx on public.overtime_requests(employee_id, overtime_date desc);
create index if not exists overtime_status_idx on public.overtime_requests(status, created_at desc);
create index if not exists overtime_line_manager_idx on public.overtime_requests(line_manager_id, status);
create index if not exists overtime_department_head_idx on public.overtime_requests(department_head_id, status);

alter table public.overtime_requests enable row level security;
alter table public.overtime_notification_log enable row level security;

drop policy if exists "overtime visibility" on public.overtime_requests;
drop policy if exists "employees submit overtime" on public.overtime_requests;
drop policy if exists "authorized approvers decide overtime" on public.overtime_requests;
drop policy if exists "admin full overtime control" on public.overtime_requests;
drop policy if exists "notification log visibility" on public.overtime_notification_log;

create policy "overtime visibility" on public.overtime_requests
for select to authenticated using (
  employee_id = auth.uid()
  or submitted_by = auth.uid()
  or line_manager_id = auth.uid()
  or department_head_id = auth.uid()
  or public.current_user_role() in ('hr','admin')
);

create policy "employees submit overtime" on public.overtime_requests
for insert to authenticated with check (
  submitted_by = auth.uid()
  and (
    employee_id = auth.uid()
    or public.current_user_role() = 'admin'
  )
);

create policy "authorized approvers decide overtime" on public.overtime_requests
for update to authenticated using (
  line_manager_id = auth.uid()
  or department_head_id = auth.uid()
  or public.current_user_role() = 'admin'
) with check (
  line_manager_id = auth.uid()
  or department_head_id = auth.uid()
  or public.current_user_role() = 'admin'
);

create policy "admin full overtime control" on public.overtime_requests
for all to authenticated using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "notification log visibility" on public.overtime_notification_log
for select to authenticated using (
  public.current_user_role() in ('hr','admin')
  or exists (
    select 1 from public.overtime_requests r
    where r.id = overtime_request_id
      and (r.employee_id = auth.uid() or r.line_manager_id = auth.uid() or r.department_head_id = auth.uid())
  )
);

grant select, insert, update on public.overtime_requests to authenticated;
grant select on public.overtime_notification_log to authenticated;
