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
alter table public.prep_sessions
  add column credit_consumed_at timestamptz null,
  add column credit_refunded_at timestamptz null;

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
  update public.profiles
     set prep_credits = prep_credits - 1
   where id = p_user_id
     and prep_credits > 0;
  get diagnostics v_afetadas = row_count;
  if v_afetadas > 0 then
    update public.prep_sessions
       set credit_consumed_at = now(),
           credit_refunded_at = null
     where id = p_session_id;
  end if;
  return v_afetadas > 0;
end;
$$;

REVOKE ALL ON FUNCTION public.consume_prep_credit(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_prep_credit(uuid, uuid) TO service_role;

-- 2) Creditar N em vez de 1.
--
-- ATENÇÃO: `CREATE OR REPLACE FUNCTION` com lista de argumentos DIFERENTE
-- cria uma SOBRECARGA nova, não substitui a antiga. Com DEFAULT, a chamada
-- de 8 argumentos que o webhook faz hoje viraria ambígua entre as duas e o
-- Postgres devolveria "function is not unique" — ou seja, TODO pagamento
-- confirmado falharia. Por isso a antiga é derrubada explicitamente.
drop function if exists public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date
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
) returns void
language plpgsql
security definer
set search_path = public
as $$
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
    UPDATE profiles
       SET tier = 'pro',
           subscription_status = 'active',
           subscription_renews_at = p_next_due_date
     WHERE id = p_user_id;
  ELSE
    -- prep_purchase: credita a quantidade comprada, atômico.
    UPDATE profiles
       SET prep_credits = COALESCE(prep_credits, 0) + p_credits
     WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date, integer
) TO service_role;

-- 3) Estornar N. Mesma armadilha de sobrecarga.
drop function if exists public.handle_payment_refunded(uuid, text, text);

create or replace function public.handle_payment_refunded(
  p_user_id    uuid,
  p_payment_id text,
  p_kind       text,
  p_credits    integer DEFAULT 1
) returns void
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  UPDATE payments
     SET status = 'refunded'
   WHERE asaas_payment_id = p_payment_id;

  IF p_kind = 'pro_subscription' THEN
    UPDATE profiles
       SET tier = 'free',
           subscription_status = 'expired'
     WHERE id = p_user_id;
  ELSIF p_kind = 'prep_purchase' THEN
    UPDATE profiles
       SET prep_credits = GREATEST(0, COALESCE(prep_credits, 0) - p_credits)
     WHERE id = p_user_id;
  END IF;
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
  update public.prep_sessions
     set credit_refunded_at = now()
   where id = p_session_id
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
