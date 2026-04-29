-- 0011_admin_flag_and_rls_hardening.sql
--
-- Two related fixes:
--
-- A) Add `is_admin` column to profiles (idempotent — production already has
--    this, but the migration was never committed to the repo, breaking
--    Supabase Preview branches and any fresh staging environment).
--
-- B) Close two RLS holes that together allow any authenticated user to
--    grant themselves admin/Pro for free via the public anon key:
--
--    1. `profiles.UPDATE` policy used `USING (auth.uid() = id)` with no
--       `WITH CHECK`, so a row could be moved to another user_id.
--    2. Even with `WITH CHECK`, RLS does not restrict which COLUMNS can
--       be updated. Postgres column-level GRANTs (separate from RLS) are
--       the only enforcement here. The default Supabase setup grants
--       UPDATE on every column to `authenticated`, including
--       `is_admin`, `tier`, `subscription_status`, `prep_credits`, etc.
--       Result: any logged-in user could open browser devtools and
--       run `supabase.from('profiles').update({is_admin:true, tier:'pro'})`
--       and become admin.
--
--    Same WITH CHECK gap exists on `prep_sessions.UPDATE` — fixed too.
--
-- After this migration, server-side code paths that write billing/quota
-- columns (asaas_customer_id, asaas_subscription_id, cpf_cnpj,
-- prep_credits, preps_used_this_month) MUST use the service-role
-- client (createAdminClient). The previous commit migrated the two
-- code paths that needed it: api/billing/checkout, app/prep/new/actions.

-- ───────────────────────────────────────────────────────────────────────────
-- A) is_admin column (idempotent — already present in prod)
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_is_admin_idx ON public.profiles (is_admin)
  WHERE is_admin = true;

-- ───────────────────────────────────────────────────────────────────────────
-- B1) profiles UPDATE: add WITH CHECK to prevent row-id rewrite
-- ───────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ───────────────────────────────────────────────────────────────────────────
-- B2) profiles column-level UPDATE: only safe columns for users
-- ───────────────────────────────────────────────────────────────────────────
--
-- Revoke the table-level UPDATE that Supabase grants by default (covers
-- every column), then grant ONLY the columns a user is allowed to write
-- through profile UI (full_name, language preference, avatar pointer).
--
-- Everything else (billing, quota, admin flag) is server-managed — those
-- updates must come from the service-role client.

REVOKE UPDATE ON public.profiles FROM anon, authenticated;

GRANT UPDATE (
  full_name,
  preferred_language,
  avatar_url,
  avatar_updated_at
) ON public.profiles TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- B3) prep_sessions UPDATE: add WITH CHECK to prevent row-hijack
-- ───────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update own prep sessions" ON public.prep_sessions;

CREATE POLICY "Users can update own prep sessions" ON public.prep_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
