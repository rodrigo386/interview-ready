-- 0013_webhook_handlers_atomic.sql
--
-- Atomic stored procedures for Asaas webhook handlers. The TS version
-- (lib/billing/webhook.ts) made 2-3 separate writes per event which
-- could leave state inconsistent if the connection dropped between
-- writes (user paid, payments row inserted, but profile update lost
-- → "I paid but I don't have Pro").
--
-- All four handlers now run as a single transaction inside a SECURITY
-- DEFINER function. As a bonus, prep_credits and refund decrement are
-- now atomic UPDATE-with-expression (`prep_credits = prep_credits + 1`)
-- instead of read-modify-write — eliminates a race between concurrent
-- webhooks (Asaas occasionally fires duplicate events past idempotency
-- window if our endpoint takes too long to respond).
--
-- All functions:
--   - Locked to service_role via REVOKE/GRANT (anon/authenticated can't call)
--   - Take p_user_id + payment-shape fields directly (typed args, not jsonb,
--     so the planner can plan and Postgres validates types at parse time)
--
-- Old TS code paths in webhook.ts call these via supabase.rpc(...).

-- ───────────────────────────────────────────────────────────────────────────
-- handle_payment_received(user_id, payment_id, kind, amount_cents,
--                         billing_method, paid_at, raw_payload, next_due_date)
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_payment_received(
  p_user_id        uuid,
  p_payment_id     text,
  p_kind           text,
  p_amount_cents   integer,
  p_billing_method text,
  p_paid_at        timestamptz,
  p_raw_payload    jsonb,
  p_next_due_date  date DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- prep_purchase: atomic +1 to credits, no read-modify-write.
    UPDATE profiles
       SET prep_credits = COALESCE(prep_credits, 0) + 1
     WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_payment_received(
  uuid, text, text, integer, text, timestamptz, jsonb, date
) TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- handle_payment_overdue
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_payment_overdue(
  p_user_id        uuid,
  p_payment_id     text,
  p_kind           text,
  p_amount_cents   integer,
  p_billing_method text,
  p_raw_payload    jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO payments (
    user_id, asaas_payment_id, kind, amount_cents, status,
    billing_method, raw_payload
  ) VALUES (
    p_user_id, p_payment_id, p_kind, p_amount_cents, 'overdue',
    p_billing_method, p_raw_payload
  )
  ON CONFLICT (asaas_payment_id) DO UPDATE SET
    status      = EXCLUDED.status,
    raw_payload = EXCLUDED.raw_payload;

  UPDATE profiles
     SET subscription_status = 'overdue'
   WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_overdue(
  uuid, text, text, integer, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_payment_overdue(
  uuid, text, text, integer, text, jsonb
) TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- handle_payment_refunded
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_payment_refunded(
  p_user_id    uuid,
  p_payment_id text,
  p_kind       text  -- nullable in practice when externalReference is missing
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
       SET prep_credits = GREATEST(0, COALESCE(prep_credits, 0) - 1)
     WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_refunded(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_payment_refunded(uuid, text, text)
  TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- handle_subscription_deleted — cancellation
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_subscription_deleted(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
     SET subscription_status = 'canceled',
         tier = 'free'
   WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_subscription_deleted(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_subscription_deleted(uuid)
  TO service_role;
