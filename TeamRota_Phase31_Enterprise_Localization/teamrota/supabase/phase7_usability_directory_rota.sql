-- TEAMROTA PHASE 7: USABILITY, DIRECTORY, ROTA AND DOCUMENT ACCESS
-- Run after phase6_hr_profile_notifications.sql.

-- Performance indexes for larger annual/monthly rota and manager views.
create index if not exists profiles_manager_active_idx on public.profiles(manager_id, employment_status);
create index if not exists rota_employee_date_idx on public.rota_assignments(employee_id, work_date);
create index if not exists leave_employee_dates_status_idx on public.leave_requests(employee_id, start_date, end_date, status);
create index if not exists holidays_scope_date_idx on public.holidays(holiday_date, department_id, office_location, active);

-- Ensure managers can read supporting documents for requests routed to them.
drop policy if exists "leave document authorized read" on storage.objects;
create policy "leave document authorized read" on storage.objects for select to authenticated
using (
  bucket_id='leave-documents'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.current_user_role() in ('admin','hr')
    or exists (
      select 1 from public.leave_requests lr
      where lr.attachment_path = storage.objects.name
        and (lr.approver_id=auth.uid() or lr.department_head_id=auth.uid())
    )
  )
);

-- Keep maternity and nursing rules active and explicit.
update public.leave_types set active=true, annual_allowance=72, day_basis='calendar', entitlement_unit='days', eligibility_gender='female', requires_document=true where code='MAT';
update public.leave_types set active=true, annual_allowance=365, entitlement_unit='hours', eligibility_gender='female' where code='NB';
