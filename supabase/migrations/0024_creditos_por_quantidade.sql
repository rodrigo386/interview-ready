-- 0024_creditos_por_quantidade.sql
-- 1) Consumo atômico: o UPDATE condicional é o cadeado. Se afetar 0 linhas,
--    não havia saldo (ou outra transação levou o último crédito primeiro).
create or replace function public.consume_prep_credit(p_user_id uuid)
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
  return v_afetadas > 0;
end;
$$;

REVOKE ALL ON FUNCTION public.consume_prep_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_prep_credit(uuid) TO service_role;

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

-- 4) Devolver 1 crédito quando a geração falha depois de já ter sido
--    consumida. Sem isto, uma falha de pipeline (Gemini fora do ar, schema
--    inválido, etc.) cobra a pessoa e não entrega nada.
create or replace function public.refund_prep_credit(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set prep_credits = prep_credits + 1 where id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.refund_prep_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_prep_credit(uuid) TO service_role;
