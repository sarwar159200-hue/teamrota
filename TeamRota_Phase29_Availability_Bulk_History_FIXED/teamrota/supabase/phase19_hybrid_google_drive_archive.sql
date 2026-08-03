create table if not exists public.document_archives (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('leave_document','timesheet','payroll_timesheet','backup')),
  entity_id uuid null,
  employee_id uuid null references public.profiles(id) on delete set null,
  archive_year integer null,
  archive_month integer null check (archive_month is null or archive_month between 1 and 12),
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint null,
  provider text not null default 'google_drive',
  provider_file_id text null,
  provider_folder_id text null,
  provider_web_url text null,
  archive_status text not null default 'pending' check (archive_status in ('pending','archived','failed','skipped')),
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  archived_by uuid null references public.profiles(id) on delete set null,
  archived_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_archives_entity on public.document_archives(entity_type, entity_id);
create index if not exists idx_document_archives_employee_period on public.document_archives(employee_id, archive_year, archive_month);
create index if not exists idx_document_archives_status_created on public.document_archives(archive_status, created_at desc);

alter table public.document_archives enable row level security;
drop policy if exists document_archives_select on public.document_archives;
create policy document_archives_select on public.document_archives for select to authenticated using (
  employee_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        lower(p.app_role::text) in ('admin','hr')
        or lower(coalesce(p.job_title,'')) ~ '(human resources?|human capital|people (&|and) culture|personnel|(^|[^a-z])hr([^a-z]|$))'
      )
  )
);

comment on table public.document_archives is 'Metadata and audit status for long-term TeamRota records archived to Google Drive.';
