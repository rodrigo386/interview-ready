-- Migration 0023: análises ATS anônimas
-- Análises ATS feitas sem cadastro. Acesso só por service-role: o token em
-- cookie HttpOnly é a autorização, validada em server action.
create table if not exists public.anon_ats_analyses (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  cv_text text not null,
  job_description text not null,
  job_title text,
  company_name text,
  analysis jsonb,
  status text not null default 'pending',
  error_message text,
  model_used text,
  ip_hash text,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists anon_ats_analyses_token_idx
  on public.anon_ats_analyses (token);
create index if not exists anon_ats_analyses_created_at_idx
  on public.anon_ats_analyses (created_at desc);

alter table public.anon_ats_analyses enable row level security;
-- Nenhuma policy: nem anon nem authenticated leem esta tabela diretamente.
