-- 0014_pro_soft_cap.sql
--
-- Soft monthly cap on Pro accounts to bound Gemini-token cost from a
-- malicious or runaway Pro subscription. The hourly rate limit
-- (createPrep 3/h) caps acute spikes; this caps sustained abuse over a
-- billing cycle.
--
-- Reset is lazy (server-side, by `createPrep`) on first prep of a new
-- calendar month. No cron, no Asaas-cycle coupling. Cheap and predictable.
--
-- Both columns are server-managed: writes go through the service-role
-- client. Migration 0011 already revoked authenticated UPDATE on the
-- table and re-granted only the user-writable columns (full_name,
-- preferred_language, avatar_*), so these new columns are unwritable
-- from the anon/authenticated role by design — no extra GRANT changes.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preps_this_billing_cycle INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_cycle_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Helps /admin/health "Pro above soft cap" query without a full table scan.
CREATE INDEX IF NOT EXISTS profiles_preps_this_cycle_idx
  ON public.profiles (preps_this_billing_cycle)
  WHERE preps_this_billing_cycle > 0;
