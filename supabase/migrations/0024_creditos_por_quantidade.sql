-- 0024_creditos_por_quantidade.sql

-- 0) Registro do ciclo de vida do crédito NA PRÓPRIA SESSÃO.
--
-- Rodadas 1-3 de correção da Task 4 (consumo atômico) fecharam uma corrida
-- de cada vez sem nunca resolver a raiz: o sistema não guardava, em lugar
-- nenhum, "esta sessão consumiu crédito" nem "esta sessão já teve o
-- crédito devolvido". Toda devolução tinha que adivinhar o passado a
-- partir de `generation_status`, que é volátil e reescrito pelo próprio
-- pipeline — daí dois runners paralelos devolvendo, `deleteFailedPrep`
-- devolvendo duas vezes, devolução indevida pra sessão que nunca consumiu.
--
-- Com essas duas colunas, a devolução vira idempotente POR SESSÃO: o UPDATE
-- condicional em `refund_prep_credit` (bloco 5) só credita se
-- `credit_consumed_at` não for nulo E `credit_refunded_at` for nulo, e
-- marca `credit_refunded_at` no MESMO UPDATE que decide creditar — mesmo
-- espírito do cadeado de `consume_prep_credit` (bloco 1), só que a fonte de
-- verdade agora é a sessão, não mais o profile ou o generation_status.
--
-- `IF NOT EXISTS` porque o Supabase Preview re-roda as migrations do zero a
-- cada rebase e um `add column` cru derruba a branch inteira com "column
-- already exists" (mesmo motivo da 0017).
alter table public.prep_sessions
  add column if not exists credit_consumed_at timestamptz null,
  add column if not exists credit_refunded_at timestamptz null;

-- 1) Consumo atômico: o UPDATE condicional em `profiles` é o cadeado
--    contra duplo consumo — se afetar 0 linhas, não havia saldo (ou outra
--    transação levou o último crédito primeiro). Quando afeta, também
--    grava `credit_consumed_at` na sessão, REINICIANDO o ciclo (zera
--    `credit_refunded_at` de qualquer tentativa anterior): um retry que
--    cobra de novo é um consumo NOVO, e precisa poder ser devolvido de
--    novo se ESTA tentativa também falhar.
create or replace function public.consume_prep_credit(p_user_id uuid, p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afetadas int;
begin
  -- Guarda de posse NO BANCO: sem ela, um `p_session_id` de outro usuário
  -- debitaria o crédito de `p_user_id` e marcaria o consumo na sessão alheia.
  -- Hoje os callers já validam a posse antes de chamar, mas a barreira não
  -- pode depender só disso — quem move dinheiro checa por conta própria.
  -- Falha fechada: devolve false e o caller barra a geração.
  if not exists (
    select 1 from public.prep_sessions
     where id = p_session_id and user_id = p_user_id
  ) then
    return false;
  end if;

  update public.profiles
     set prep_credits = prep_credits - 1
   where id = p_user_id
     and prep_credits > 0;
  get diagnostics v_afetadas = row_count;
  if v_afetadas > 0 then
    update public.prep_sessions
       set credit_consumed_at = now(),
           credit_refunded_at = null
     where id = p_session_id
       and user_id = p_user_id;
  end if;
  return v_afetadas > 0;
end;
$$;

REVOKE ALL ON FUNCTION public.consume_prep_credit(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_prep_credit(uuid, uuid) TO service_role;

-- 1.5) Registro do ciclo de vida do crédito NO PRÓPRIO PAGAMENTO.
--
-- Mesmo remédio do bloco 0, um nível acima: lá o problema era "esta SESSÃO
-- já teve o crédito devolvido?", aqui é "este PAGAMENTO já foi creditado?".
-- O `ON CONFLICT (asaas_payment_id)` do bloco 2 sempre dedupou a LINHA de
-- `payments`, mas o `UPDATE profiles SET prep_credits = ... + p_credits`
-- logo em seguida era INCONDICIONAL — duas entradas para o MESMO pagamento
-- creditavam duas vezes. E existem duas entradas de sobra:
--
--   (a) o webhook do Asaas está configurado com `PAYMENT_CONFIRMED` E
--       `PAYMENT_RECEIVED`, e o Asaas emite os dois para o mesmo pagamento
--       (cartão: CONFIRMED na autorização, RECEIVED na liquidação). São
--       eventos DIFERENTES, com `asaas_event_id` diferente, então a
--       idempotência por evento de `subscription_events` não pega nada;
--   (b) `reconcileBillingFromAsaas` (`src/lib/billing/reconcile.ts`), que
--       roda no retorno do checkout (`/dashboard?billing=ok`), credita o
--       mesmo pagamento que o webhook credita — em qualquer ordem.
--
-- Com estas colunas a concessão vira idempotente POR PAGAMENTO: o UPDATE
-- condicional em `payments` é o cadeado (mesmo espírito de
-- `consume_prep_credit` e `refund_prep_credit`), e a marca é gravada no
-- MESMO UPDATE que decide creditar. Quem chegar depois afeta 0 linhas e
-- devolve 0 — não importa quantas vezes, nem por qual caminho.
--
-- `credits_granted` guarda QUANTOS créditos aquele pagamento concedeu, para
-- o estorno devolver exatamente isso (um pacote de 5 estornado tira 5, não
-- 1) sem depender de reparsear o `externalReference` no caminho de saída.
alter table public.payments
  add column if not exists credits_granted    integer not null default 0,
  add column if not exists credits_granted_at timestamptz null,
  add column if not exists credits_revoked_at timestamptz null;

-- Backfill: pagamentos que JÁ passaram pelo `handle_payment_received` antigo
-- já tiveram o crédito concedido pela versão incondicional. Sem esta marca,
-- a primeira execução do reconcile depois do deploy varre os últimos 20
-- pagamentos do cliente, vê `credits_granted_at IS NULL` e credita tudo de
-- novo. Todo pagamento avulso anterior a esta branch valia 1 (o formato
-- `prep:<uid>:<qtd>:<nano>` nasceu aqui), daí o literal.
update public.payments
   set credits_granted_at = coalesce(paid_at, created_at, now()),
       credits_granted    = case when kind = 'prep_purchase' then 1 else 0 end
 where credits_granted_at is null
   and status in ('confirmed', 'received', 'refunded');

update public.payments
   set credits_revoked_at = coalesce(paid_at, created_at, now())
 where status = 'refunded'
   and credits_revoked_at is null;

-- 2) Creditar N em vez de 1, no máximo UMA vez por pagamento.
--
-- ATENÇÃO: `CREATE OR REPLACE FUNCTION` com lista de argumentos DIFERENTE
-- cria uma SOBRECARGA nova, não substitui a antiga. Com DEFAULT, a chamada
-- de 8 argumentos que o webhook faz hoje viraria ambígua entre as duas e o
-- Postgres devolveria "function is not unique" — ou seja, TODO pagamento
-- confirmado falharia. Por isso a antiga é derrubada explicitamente.
drop function if exists public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date
);
-- E a de 9 argumentos também: ela nasceu nesta mesma migration devolvendo
-- `void`, e `CREATE OR REPLACE` NÃO muda tipo de retorno ("cannot change
-- return type of existing function"). Sem este drop, reaplicar a migration
-- por cima de uma versão anterior dela mesma falha — e o Supabase Preview
-- re-roda tudo do zero a cada rebase.
drop function if exists public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date, integer
);

create or replace function public.handle_payment_received(
  p_user_id        uuid,
  p_payment_id     text,
  p_kind           text,
  p_amount_cents   integer,
  p_billing_method text,
  p_paid_at        timestamptz,
  p_raw_payload    jsonb,
  p_next_due_date  date DEFAULT NULL,
  p_credits        integer DEFAULT 1
) returns integer
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_afetadas int;
BEGIN
  INSERT INTO payments (
    user_id, asaas_payment_id, kind, amount_cents, status,
    billing_method, paid_at, raw_payload
  ) VALUES (
    p_user_id, p_payment_id, p_kind, p_amount_cents, 'received',
    p_billing_method, p_paid_at, p_raw_payload
  )
  ON CONFLICT (asaas_payment_id) DO UPDATE SET
    status         = EXCLUDED.status,
    amount_cents   = EXCLUDED.amount_cents,
    billing_method = EXCLUDED.billing_method,
    paid_at        = EXCLUDED.paid_at,
    raw_payload    = EXCLUDED.raw_payload;

  IF p_kind = 'pro_subscription' THEN
    -- Assinatura não concede crédito, e este UPDATE é idempotente por
    -- natureza (grava um estado, não incrementa um saldo).
    UPDATE profiles
       SET tier = 'pro',
           subscription_status = 'active',
           subscription_renews_at = p_next_due_date
     WHERE id = p_user_id;
    RETURN 0;
  END IF;

  -- prep_purchase: O CADEADO. Só concede se este pagamento nunca concedeu.
  -- O `INSERT ... ON CONFLICT` acima já segurou o lock desta linha até o
  -- fim da transação, então uma segunda chamada concorrente para o mesmo
  -- `asaas_payment_id` só chega aqui depois do commit da primeira — e aí
  -- encontra `credits_granted_at` preenchido e afeta 0 linhas.
  UPDATE payments
     SET credits_granted_at = now(),
         credits_granted    = p_credits
   WHERE asaas_payment_id = p_payment_id
     AND credits_granted_at IS NULL;
  GET DIAGNOSTICS v_afetadas = row_count;
  IF v_afetadas = 0 THEN
    RETURN 0;
  END IF;

  UPDATE profiles
     SET prep_credits = COALESCE(prep_credits, 0) + p_credits
   WHERE id = p_user_id;
  RETURN p_credits;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date, integer
) TO service_role;

-- 3) Estornar exatamente o que foi concedido, no máximo uma vez. Mesma
--    armadilha de sobrecarga, e a mesma troca de `void` por `integer`.
drop function if exists public.handle_payment_refunded(uuid, text, text);
drop function if exists public.handle_payment_refunded(uuid, text, text, integer);

create or replace function public.handle_payment_refunded(
  p_user_id    uuid,
  p_payment_id text,
  p_kind       text,
  -- LEGADO, IGNORADO DE PROPÓSITO. A quantidade a estornar vem de
  -- `payments.credits_granted` — o que ESTE pagamento de fato concedeu —,
  -- nunca de um reparse do `externalReference` no caminho de saída. Se um
  -- pagamento nunca concedeu nada (estorno de cobrança que nunca foi
  -- creditada), o estorno não pode tirar crédito do saldo. Mantido na
  -- assinatura só para não quebrar o call site do webhook.
  p_credits    integer DEFAULT 1
) returns integer
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_creditos int;
BEGIN
  UPDATE payments
     SET status = 'refunded'
   WHERE asaas_payment_id = p_payment_id;

  IF p_kind = 'pro_subscription' THEN
    UPDATE profiles
       SET tier = 'free',
           subscription_status = 'expired'
     WHERE id = p_user_id;
    RETURN 0;
  END IF;

  -- Cadeado simétrico ao do bloco 2: só tira do saldo se este pagamento
  -- tinha de fato concedido (`credits_granted_at IS NOT NULL`) e ainda não
  -- tinha sido estornado (`credits_revoked_at IS NULL`), e a marca é
  -- gravada no MESMO UPDATE que decide tirar. `RETURNING ... INTO` deixa
  -- `v_creditos` nulo quando 0 linhas são afetadas.
  UPDATE payments
     SET credits_revoked_at = now()
   WHERE asaas_payment_id = p_payment_id
     AND credits_granted_at IS NOT NULL
     AND credits_revoked_at IS NULL
  RETURNING credits_granted INTO v_creditos;

  IF v_creditos IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE profiles
     SET prep_credits = GREATEST(0, COALESCE(prep_credits, 0) - v_creditos)
   WHERE id = p_user_id;
  RETURN v_creditos;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_refunded(uuid, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_payment_refunded(uuid, text, text, integer)
  TO service_role;

-- 4) Creditar 1 de volta SEM nenhuma checagem — bloco de construção
--    reaproveitado pelo `refund_prep_credit` (bloco 5) e por
--    `deleteFailedPrep` (TS) quando a sessão já foi apagada e não tem mais
--    como checar `credit_consumed_at`/`credit_refunded_at` nela mesma. Não
--    expor além do service_role: nada nesta função sozinha impede creditar
--    sem consumo correspondente — quem chama é responsável por já ter
--    provado, por conta própria, que o crédito é devido exatamente uma vez.
create or replace function public.credit_prep_refund(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set prep_credits = COALESCE(prep_credits, 0) + 1 where id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.credit_prep_refund(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_prep_refund(uuid) TO service_role;

-- 5) Devolver o crédito de UMA sessão específica, idempotente por sessão.
--    O UPDATE em `prep_sessions` É O CADEADO — mesmo espírito de
--    `consume_prep_credit` (bloco 1), só que a condição agora é sobre a
--    própria sessão em vez de sobre o saldo: só credita se esta sessão
--    tinha consumido (`credit_consumed_at IS NOT NULL`) e ainda não tinha
--    sido devolvida (`credit_refunded_at IS NULL`), e a marcação de
--    `credit_refunded_at` acontece no MESMO UPDATE que decide creditar. Não
--    tem como rodar duas vezes pra mesma sessão (dois runners paralelos, um
--    retry que falha de novo, um duplo clique em "excluir") e creditar duas
--    vezes — a segunda chamada afeta 0 linhas e devolve `false`.
create or replace function public.refund_prep_credit(p_user_id uuid, p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afetadas int;
begin
  -- `user_id = p_user_id` é a guarda de posse: sem ela, um id de sessão
  -- errado creditaria o saldo de um usuário consumindo a marca de outro.
  update public.prep_sessions
     set credit_refunded_at = now()
   where id = p_session_id
     and user_id = p_user_id
     and credit_consumed_at is not null
     and credit_refunded_at is null;
  get diagnostics v_afetadas = row_count;
  if v_afetadas > 0 then
    perform public.credit_prep_refund(p_user_id);
  end if;
  return v_afetadas > 0;
end;
$$;

REVOKE ALL ON FUNCTION public.refund_prep_credit(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_prep_credit(uuid, uuid) TO service_role;

-- 5.5) Concessão manual de crédito pelo operador.
--
-- Sem isto não existia NENHUM caminho no código que aumentasse
-- `prep_credits` fora do webhook e do reconcile: o `GrantProButton` do
-- `/admin/users` só escreve `tier = 'pro'`, e o `checkQuota` deixou de olhar
-- para `tier` — o botão "Conceder Pro" não destrava uma preparação sequer.
-- Vão existir clientes que pagaram e não receberam (estorno que não voltou,
-- pagamento que caiu fora do webhook e fora da janela do reconcile, falha
-- que não devolveu), e o operador precisa poder compensar sem abrir o SQL
-- Editor de produção.
--
-- Incremento atômico dentro do banco, e não read-modify-write no TS, pelo
-- mesmo motivo de todo o resto desta migration: é saldo, não estado.
--
-- Teto de 50 por chamada: é botão de compensação pontual, não de emissão em
-- massa. Erro de digitação num campo de número não pode virar saldo
-- ilimitado. `raise exception` (em vez de devolver 0) porque quem chama é
-- uma action de admin que precisa distinguir "não fiz nada" de "fiz" —
-- silêncio aqui viraria concessão fantasma.
create or replace function public.admin_grant_prep_credits(
  p_user_id uuid,
  p_credits integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo int;
begin
  if p_credits is null or p_credits < 1 or p_credits > 50 then
    raise exception 'p_credits fora do intervalo permitido (1..50): %', p_credits;
  end if;

  update public.profiles
     set prep_credits = COALESCE(prep_credits, 0) + p_credits
   where id = p_user_id
  returning prep_credits into v_saldo;

  if v_saldo is null then
    raise exception 'perfil % não encontrado', p_user_id;
  end if;

  return v_saldo;
end;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_prep_credits(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_prep_credits(uuid, integer)
  TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 6) prep_sessions: privilégio por COLUNA (mesmo molde da 0011 em `profiles`)
-- ───────────────────────────────────────────────────────────────────────────
--
-- RLS decide QUAIS LINHAS, nunca QUAIS COLUNAS. As policies de
-- `prep_sessions` (0011) garantem "só a própria linha" e nada mais — com o
-- INSERT/UPDATE de tabela inteira que o Supabase concede por padrão a
-- `authenticated`, qualquer pessoa logada podia escrever, com a anon key
-- direto do navegador, exatamente as colunas que decidem dinheiro:
--
--   1. `update({ credit_refunded_at: null })` reciclava uma devolução já
--      feita — a sessão voltava a "consumida e não devolvida" e uma nova
--      devolução era liberada. Repetível: 1 crédito comprado virava saldo
--      infinito.
--   2. `insert({ credit_consumed_at: now() })` fabricava uma sessão que
--      "pagou" sem nunca ter pago; excluí-la devolvia +1.
--   3. `update({ generation_status: 'failed' })` numa prep JÁ ENTREGUE (PDF
--      exportado) fazia a tela de falha aparecer, e o "Excluir e começar de
--      novo" via a linha como consumida-e-não-devolvida e creditava +1.
--
-- Por isso o ciclo de vida da geração (`generation_status`, `error_message`,
-- `prep_guide`, `progress_step`) sai da mão do cliente junto com as duas
-- colunas de crédito: é o pipeline (`src/lib/ai/pipeline.ts`) e os cadeados
-- de `retryPrep`/`generateFullPrep` que escrevem esses campos, e todos
-- passaram a usar o service-role client neste mesmo commit.
--
-- O que sobra pra `authenticated` são só os artefatos de IA que o próprio
-- usuário dispara e re-dispara pela UI (ATS, reescrita de CV, pesquisa da
-- empresa, benchmark salarial). Nenhum deles decide cobrança.
REVOKE INSERT, UPDATE ON public.prep_sessions FROM anon, authenticated;

-- INSERT: exatamente as colunas que `createPrep` grava
-- (`src/app/prep/new/actions.ts`). `credit_consumed_at` fora da lista é o que
-- impede fabricar uma sessão "já paga".
GRANT INSERT (
  user_id,
  job_title,
  company_name,
  cv_text,
  cv_id,
  job_description,
  generation_status
) ON public.prep_sessions TO authenticated;

-- UPDATE: só os artefatos de IA re-disparáveis pela UI —
-- `runAtsAnalysis`/`runCvRewrite` (`ats-actions.ts`, `rewrite-actions.ts`),
-- `rerunCompanyIntel`/`rerunSalaryBenchmark` (`prep/[id]/actions.ts`) e o
-- reset de reescrita do perfil (`(app)/profile/actions.ts`).
GRANT UPDATE (
  ats_analysis,
  ats_status,
  ats_error_message,
  company_intel,
  company_intel_status,
  company_intel_error,
  salary_benchmark,
  salary_benchmark_status,
  salary_benchmark_error,
  cv_rewrite,
  cv_rewrite_status,
  cv_rewrite_error
) ON public.prep_sessions TO authenticated;
