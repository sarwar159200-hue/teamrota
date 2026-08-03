-- TeamRota Phase 13: Intelligent HR Authority
-- Existing and future employees are treated as HR when their job title clearly
-- contains HR / Human Resource terminology. Admin accounts are never downgraded.

create or replace function public.teamrota_is_hr_job_title(title text)
returns boolean
language sql
immutable
as $$
  select coalesce(title, '') ~* '(^|[^a-z])hr([^a-z]|$)|human[[:space:]]+resources?|human[[:space:]]+capital|people[[:space:]]*(&|and)[[:space:]]*culture|personnel';
$$;

-- Upgrade existing matching employees to the HR application role so all current
-- RLS policies and server actions recognize them immediately.
update public.profiles
set app_role = 'hr'
where coalesce(app_role::text, '') <> 'admin'
  and public.teamrota_is_hr_job_title(job_title);

-- Keep the role synchronized whenever an employee is created or their title changes.
create or replace function public.teamrota_sync_hr_role_from_job_title()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.app_role::text, '') <> 'admin'
     and public.teamrota_is_hr_job_title(new.job_title) then
    new.app_role := 'hr';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_teamrota_sync_hr_role_from_job_title on public.profiles;
create trigger trg_teamrota_sync_hr_role_from_job_title
before insert or update of job_title, app_role
on public.profiles
for each row
execute function public.teamrota_sync_hr_role_from_job_title();

-- Helpful index for employee searches and HR-title checks.
create index if not exists idx_profiles_job_title_lower
on public.profiles (lower(coalesce(job_title, '')));
