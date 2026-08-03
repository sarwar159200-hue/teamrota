-- TEAMROTA PHASE 6: HR WORKFLOW, PROFILE PHOTOS, SICK DOCUMENTS, ROLE KPI SECURITY
-- Run after phase5_annual_rota_leave.sql.

alter table public.leave_requests
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists department_head_id uuid references public.profiles(id) on delete set null;

create table if not exists public.leave_notification_log (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid references public.leave_requests(id) on delete cascade,
  event_type text not null,
  recipient_email text,
  delivery_status text not null check (delivery_status in ('sent','failed','skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.leave_notification_log enable row level security;
drop policy if exists "admin hr view leave notification logs" on public.leave_notification_log;
create policy "admin hr view leave notification logs" on public.leave_notification_log for select to authenticated
using (public.current_user_role() in ('admin','hr'));
grant select,insert on public.leave_notification_log to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-photos','profile-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('leave-documents','leave-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Authenticated users can read public profile photos and upload only their own folder.
drop policy if exists "profile photos public read" on storage.objects;
create policy "profile photos public read" on storage.objects for select to authenticated using (bucket_id='profile-photos');
drop policy if exists "profile own upload" on storage.objects;
create policy "profile own upload" on storage.objects for insert to authenticated
with check (bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "profile own update" on storage.objects;
create policy "profile own update" on storage.objects for update to authenticated
using (bucket_id='profile-photos' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_user_role() in ('admin','hr')));
drop policy if exists "profile admin hr upload" on storage.objects;
create policy "profile admin hr upload" on storage.objects for insert to authenticated
with check (bucket_id='profile-photos' and public.current_user_role() in ('admin','hr'));

-- Sick/medical documents are private to employee, assigned approver, HR and Admin.
drop policy if exists "leave document upload own" on storage.objects;
create policy "leave document upload own" on storage.objects for insert to authenticated
with check (bucket_id='leave-documents' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "leave document authorized read" on storage.objects;
create policy "leave document authorized read" on storage.objects for select to authenticated
using (bucket_id='leave-documents' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_user_role() in ('admin','hr','manager')));

-- Ensure leave policies remain correct even when Phase 5 was run before gender was populated.
update public.leave_types set active=true, annual_allowance=72, day_basis='calendar', eligibility_gender='female', requires_document=true where code='MAT';
update public.leave_types set active=true, annual_allowance=365, entitlement_unit='hours', eligibility_gender='female' where code='NB';
