-- Migration 0019: Affiliate payouts audit log
-- 1 row per Asaas Transfer attempt. Lets admin trace which commissions
-- were settled in which transfer, what status came back, and any error
-- without losing context if the same payout is retried.
--
-- Workflow:
-- 1. Admin clicks "Pagar via Pix" on a partner in /admin/affiliates
-- 2. Server action sums commissions where status='confirmed' AND paid_at IS NULL
-- 3. If total >= 10000 cents (R$100), call Asaas POST /transfers
-- 4. INSERT row here with asaas_transfer_id + status (PENDING/DONE/FAILED)
-- 5. UPDATE matching commissions to status='paid', paid_at=now,
--    paid_via='asaas_transfer:<id>'
-- If Asaas fails, no commission is updated; admin can retry.

CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE RESTRICT,
  asaas_transfer_id TEXT UNIQUE,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  pix_key TEXT NOT NULL,
  pix_key_type TEXT NOT NULL CHECK (pix_key_type IN ('CPF','CNPJ','EMAIL','PHONE','EVP')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','failed','cancelled')),
  asaas_response JSONB,
  error_message TEXT,
  triggered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payouts_partner ON public.affiliate_payouts(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.affiliate_payouts(status, created_at DESC);

-- RLS: server-write only, partners can see their own payouts (audit transparency)
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners view own payouts"
  ON public.affiliate_payouts
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM public.affiliate_partners WHERE user_id = auth.uid()
    )
  );
