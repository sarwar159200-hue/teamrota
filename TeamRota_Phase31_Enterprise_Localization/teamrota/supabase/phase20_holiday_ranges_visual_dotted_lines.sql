-- TeamRota Phase 20: holiday periods, editable holiday series and performance indexes.
-- Run only after Phase 19.

alter table public.holidays add column if not exists series_id uuid;
alter table public.holidays add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.holidays add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.holidays add column if not exists updated_at timestamptz not null default now();

update public.holidays set series_id = id where series_id is null;
alter table public.holidays alter column series_id set not null;

create index if not exists holidays_series_idx on public.holidays(series_id);
create index if not exists holidays_active_scope_date_idx on public.holidays(active, holiday_date, department_id, office_location);

-- Public/company holiday rows must be organization-wide. Existing scoped public/company rows are normalized.
update public.holidays
set department_id = null, office_location = null, updated_at = now()
where holiday_type in ('public','company') and (department_id is not null or office_location is not null);

analyze public.holidays;
