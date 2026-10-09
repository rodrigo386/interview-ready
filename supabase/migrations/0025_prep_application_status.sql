-- Migration 0025: status da candidatura por preparação.
--
-- O painel listava as preps mas não dizia o que aconteceu com cada candidatura.
-- Esta coluna é o status que a PESSOA marca (preparando, candidatei,
-- entrevista marcada, proposta, encerrada) — também é o primeiro dado de
-- RESULTADO do produto, que hoje não existe.
--
-- Server-managed, como `welcome_email_sent_at`: escrita só pelo admin client
-- (server action com `.eq("user_id", ...)` explícito), sem GRANT de UPDATE pra
-- `authenticated`. Desde a 0024 o UPDATE da tabela é por coluna, então uma
-- coluna nova NÃO ganha escrita direta pelo cliente: é o que queremos.
--
-- `add column if not exists`, não `add column`: a branch de preview roda as
-- migrations de novo a cada rebase e um `add column` cru derruba o check.
--
-- ORDEM DE DEPLOY: rode ESTA migration ANTES de publicar o código que lê a
-- coluna. O `SELECT` do painel passa a pedir `application_status`; sem a coluna
-- ele dá erro e o painel inteiro quebra (mesma lição da 0020).

alter table public.prep_sessions
  add column if not exists application_status text not null default 'preparando',
  add column if not exists application_status_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prep_sessions_application_status_check'
  ) then
    alter table public.prep_sessions
      add constraint prep_sessions_application_status_check
      check (application_status in
        ('preparando', 'candidatei', 'entrevista', 'oferta', 'encerrada'));
  end if;
end $$;
