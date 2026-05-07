-- Migration 0016: Affiliate program
-- Schema for curated affiliate program with 30% lifetime recurring commission

-- 1. Add pix_key column to profiles (used for partner payouts)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- 2. Affiliate partners table
CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  commission_rate_pct INT NOT NULL DEFAULT 30
    CHECK (commission_rate_pct BETWEEN 0 AND 100),
  notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_code_active ON public.affiliate_partners(code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_partners_user ON public.affiliate_partners(user_id);

-- 3. Referrals table (1:1 with profiles)
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE RESTRICT,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  flagged_for_review BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_referrals_partner ON public.affiliate_referrals(partner_id);

-- 4. Commission ledger (1 row per payment, idempotent via UNIQUE)
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'paid', 'clawback')),
  confirmed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_via TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id)
);

CREATE INDEX IF NOT EXISTS idx_commissions_partner_status ON public.affiliate_commissions(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_commissions_status_created ON public.affiliate_commissions(status, created_at);

-- 5. RLS

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners view own row"
  ON public.affiliate_partners
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Partners view own commissions"
  ON public.affiliate_commissions
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM public.affiliate_partners WHERE user_id = auth.uid()
    )
  );

-- affiliate_referrals: NO authenticated policy (privacy: user shouldn't know who referred them).
-- All INSERT/UPDATE/DELETE on these 3 tables: service_role only (no policy = no access for authenticated).
