-- 0009_billing.sql
-- Asaas billing state: customer/subscription columns on profiles,
-- payments table (one row per processed Asaas payment),
-- subscription_events table (audit log + idempotency keys).

ALTER TABLE public.profiles
  ADD COLUMN asaas_customer_id TEXT UNIQUE,
  ADD COLUMN asaas_subscription_id TEXT,
  ADD COLUMN subscription_status TEXT
    CHECK (subscription_status IN
      ('active','overdue','canceled','expired','none')),
  ADD COLUMN subscription_renews_at TIMESTAMPTZ,
  ADD COLUMN prep_credits INT NOT NULL DEFAULT 0
    CHECK (prep_credits >= 0);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asaas_payment_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('pro_subscription','prep_purchase')),
  amount_cents INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN
    ('pending','confirmed','received','refunded','overdue','failed')),
  billing_method TEXT,
  paid_at TIMESTAMPTZ,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payments_user ON public.payments(user_id, created_at DESC);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own payments"
  ON public.payments FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  asaas_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  asaas_subscription_id TEXT,
  asaas_payment_id TEXT,
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sub_events_user ON public.subscription_events(user_id, received_at DESC);
CREATE INDEX idx_sub_events_type ON public.subscription_events(event_type);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
-- no SELECT policy: service role / Studio only.
