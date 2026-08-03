-- TeamRota Phase 17: historical rota administration and manager succession audit

create table if not exists public.rota_history_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('bulk_upsert','bulk_delete')),
  employee_scope text not null,
  start_date date not null,
  end_date date not null,
  status_code text,
  affected_rows integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists idx_rota_history_audit_created_at
  on public.rota_history_audit(created_at desc);
create index if not exists idx_rota_history_audit_actor
  on public.rota_history_audit(actor_id);

alter table public.rota_history_audit enable row level security;

drop policy if exists rota_history_audit_select on public.rota_history_audit;
create policy rota_history_audit_select
on public.rota_history_audit for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.app_role::text) in ('admin','hr')
        or coalesce(p.job_title,'') ~* '(^|[^a-z])hr([^a-z]|$)|human\\s*resources?|human\\s*capital|people\\s*(&|and)\\s*culture|personnel'
      )
  )
);

drop policy if exists rota_history_audit_insert on public.rota_history_audit;
create policy rota_history_audit_insert
on public.rota_history_audit for insert to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.app_role::text) in ('admin','hr')
        or coalesce(p.job_title,'') ~* '(^|[^a-z])hr([^a-z]|$)|human\\s*resources?|human\\s*capital|people\\s*(&|and)\\s*culture|personnel'
      )
  )
);
