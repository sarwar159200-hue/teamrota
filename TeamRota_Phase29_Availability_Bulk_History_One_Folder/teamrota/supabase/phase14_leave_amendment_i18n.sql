-- TeamRota Phase 14 Revision: leave decision amendment audit
-- Safe to run more than once.

alter table public.leave_requests
  add column if not exists amended_at timestamptz,
  add column if not exists amended_by uuid references public.profiles(id) on delete set null,
  add column if not exists amendment_reason text;

create table if not exists public.leave_decision_audit (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references public.leave_requests(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  previous_status text not null,
  new_status text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint leave_decision_audit_status_check
    check (previous_status in ('approved','rejected') and new_status in ('approved','rejected'))
);

create index if not exists leave_decision_audit_request_idx
  on public.leave_decision_audit(leave_request_id, created_at desc);

alter table public.leave_decision_audit enable row level security;

drop policy if exists leave_decision_audit_select on public.leave_decision_audit;
create policy leave_decision_audit_select
on public.leave_decision_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.app_role::text) in ('admin','hr')
        or p.job_title ~* '(^|[^a-z])hr([^a-z]|$)|human\s*resources?|human\s*capital|people\s*(&|and)\s*culture|personnel'
      )
  )
  or exists (
    select 1
    from public.leave_requests lr
    where lr.id = leave_request_id
      and (lr.employee_id = auth.uid() or lr.approver_id = auth.uid() or lr.department_head_id = auth.uid())
  )
);
