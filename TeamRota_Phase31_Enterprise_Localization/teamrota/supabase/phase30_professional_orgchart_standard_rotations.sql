-- TEAMROTA PHASE 30: PROFESSIONAL ORG CHART AND STANDARD ROTATION LIBRARY
-- Run once after the previous TeamRota migrations.

-- HR and Admin may manage rotation patterns and employee rotation assignments.
drop policy if exists "admin manage rotation patterns" on public.rotation_patterns;
create policy "admin hr manage rotation patterns" on public.rotation_patterns
for all to authenticated
using (public.current_user_role() in ('hr','admin'))
with check (public.current_user_role() in ('hr','admin'));

drop policy if exists "admin manage employee rotations" on public.employee_rotations;
create policy "admin hr manage employee rotations" on public.employee_rotations
for all to authenticated
using (public.current_user_role() in ('hr','admin'))
with check (public.current_user_role() in ('hr','admin'));

-- HR and Admin may also create explicit manual overrides.
drop policy if exists "admin manage all rota" on public.rota_assignments;
create policy "admin hr manage all rota" on public.rota_assignments
for all to authenticated
using (public.current_user_role() in ('hr','admin'))
with check (public.current_user_role() in ('hr','admin'));

insert into public.rotation_patterns
  (name, code, rotation_type, days_on, days_off, default_shift_code, description, active, updated_at)
values
  ('1 Week ON / 1 Week OFF', '7-7', 'cyclic', 7, 7, 'D', 'Seven working days followed by seven rest days', true, now()),
  ('2 Weeks ON / 2 Weeks OFF', '14-14', 'cyclic', 14, 14, 'D', 'Fourteen working days followed by fourteen rest days', true, now()),
  ('28 Days ON / 28 Days OFF', '28-28', 'cyclic', 28, 28, 'D', 'Twenty-eight working days followed by twenty-eight rest days', true, now()),
  ('6 Weeks ON / 2 Weeks OFF', '42-14', 'cyclic', 42, 14, 'D', 'Six working weeks followed by two rest weeks', true, now()),
  ('Full Time — Sunday to Thursday', 'FULL-TIME', 'office', 5, 2, 'D', 'Sunday through Thursday working; Friday and Saturday weekend', true, now())
on conflict (code) do update set
  name = excluded.name,
  rotation_type = excluded.rotation_type,
  days_on = excluded.days_on,
  days_off = excluded.days_off,
  default_shift_code = excluded.default_shift_code,
  description = excluded.description,
  active = true,
  updated_at = now();
