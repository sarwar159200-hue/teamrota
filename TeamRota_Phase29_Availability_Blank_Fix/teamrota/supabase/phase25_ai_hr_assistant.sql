-- TeamRota Phase 25: optional AI assistant audit trail.
create table if not exists public.ai_chat_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  answer text not null,
  answer_source text not null default 'ai',
  language text not null default 'en' check (language in ('en','ku','ar')),
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_logs_employee_created_idx
  on public.ai_chat_logs(employee_id, created_at desc);

alter table public.ai_chat_logs enable row level security;

drop policy if exists ai_chat_logs_own_select on public.ai_chat_logs;
create policy ai_chat_logs_own_select on public.ai_chat_logs
for select to authenticated using (employee_id = auth.uid());

-- Inserts are performed only by the server-side Supabase service role.
