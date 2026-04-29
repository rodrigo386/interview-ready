-- 0012_admin_perf_indexes_and_rpc.sql
--
-- Pre-launch performance work for admin pages and hot read paths.
--
-- A) Indexes on columns that admin/queries filter by but were sequential
--    scanning. Volumes are small today (post-launch < 1k rows everywhere)
--    so plain CREATE INDEX is fine; concurrent not needed.
--
-- B) Two SQL functions that consolidate /admin overview queries from
--    ~22 round-trips down to 2. Functions return jsonb so the TS layer
--    can narrow with a single shape declaration (`AdminOverviewRpc`).
--    Both gated to service_role since requireAdmin() runs upstream.

-- ───────────────────────────────────────────────────────────────────────────
-- A) Indexes
-- ───────────────────────────────────────────────────────────────────────────

-- /admin/users does `ilike("email", "%q%")` — without lower(email), every
-- search is a sequential scan on the whole profiles table. lower(email) lets
-- the planner use the index for case-insensitive prefix searches; for full
-- substring (% on both sides) it's still seq, but we mostly type prefixes.
CREATE INDEX IF NOT EXISTS profiles_email_lower_idx
  ON public.profiles (lower(email));

-- payments.status filtered 4× by /admin/health (failed/refunded/overdue counts)
-- and by metrics.ts (pendingPayments). Partial-friendly query selectivity.
CREATE INDEX IF NOT EXISTS payments_status_idx
  ON public.payments (status);

-- prep_sessions filtered by status across dashboard + health + admin/preps.
-- Combined with created_at (descending) since most queries are "recent N
-- failed/complete preps".
CREATE INDEX IF NOT EXISTS prep_sessions_status_created_idx
  ON public.prep_sessions (generation_status, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- B) Admin overview RPC
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_overview()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
    profile_counts AS (
      SELECT
        count(*)                                                                 AS total,
        count(*) FILTER (WHERE created_at >= now() - interval '1 day')           AS s24h,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days')          AS s7d,
        count(*) FILTER (WHERE created_at >= now() - interval '30 days')         AS s30d,
        count(*) FILTER (WHERE subscription_status='active' AND tier='pro')      AS pro_active,
        count(*) FILTER (WHERE subscription_status='overdue')                    AS overdue,
        coalesce(sum(prep_credits), 0)                                           AS total_credits
      FROM profiles
    ),
    prep_counts AS (
      SELECT
        count(*)                                                                 AS total,
        count(*) FILTER (WHERE created_at >= now() - interval '1 day')           AS p24h,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days')          AS p7d,
        count(*) FILTER (WHERE created_at >= now() - interval '30 days')         AS p30d,
        count(*) FILTER (
          WHERE generation_status='failed' AND created_at >= now() - interval '7 days'
        )                                                                        AS failed_7d,
        count(*) FILTER (
          WHERE generation_status='complete' AND created_at >= now() - interval '30 days'
        )                                                                        AS success_30d,
        count(DISTINCT user_id) FILTER (
          WHERE created_at >= now() - interval '7 days'
        )                                                                        AS active_users_7d,
        count(DISTINCT user_id) FILTER (
          WHERE created_at >= now() - interval '30 days'
        )                                                                        AS active_users_30d
      FROM prep_sessions
    ),
    activated AS (
      -- Recent signups that have at least one prep — proxy for activation.
      SELECT count(*) AS n
      FROM profiles p
      WHERE p.created_at >= now() - interval '30 days'
        AND EXISTS (SELECT 1 FROM prep_sessions ps WHERE ps.user_id = p.id)
    ),
    payment_counts AS (
      SELECT
        coalesce(sum(amount_cents) FILTER (
          WHERE status IN ('received','confirmed') AND paid_at >= now() - interval '30 days'
        ), 0)                                                                    AS revenue_30d,
        count(*) FILTER (WHERE status='pending')                                 AS pending
      FROM payments
    )
  SELECT jsonb_build_object(
    'totalUsers',       (SELECT total           FROM profile_counts),
    'signups24h',       (SELECT s24h            FROM profile_counts),
    'signups7d',        (SELECT s7d             FROM profile_counts),
    'signups30d',       (SELECT s30d            FROM profile_counts),
    'proActive',        (SELECT pro_active      FROM profile_counts),
    'overdue',          (SELECT overdue         FROM profile_counts),
    'totalCredits',     (SELECT total_credits   FROM profile_counts),
    'totalPreps',       (SELECT total           FROM prep_counts),
    'preps24h',         (SELECT p24h            FROM prep_counts),
    'preps7d',          (SELECT p7d             FROM prep_counts),
    'preps30d',         (SELECT p30d            FROM prep_counts),
    'failedPreps7d',    (SELECT failed_7d       FROM prep_counts),
    'successPreps30d',  (SELECT success_30d     FROM prep_counts),
    'activeUsers7d',    (SELECT active_users_7d FROM prep_counts),
    'activeUsers30d',   (SELECT active_users_30d FROM prep_counts),
    'activated30d',     (SELECT n               FROM activated),
    'revenueCents30d',  (SELECT revenue_30d     FROM payment_counts),
    'pendingPayments',  (SELECT pending         FROM payment_counts)
  );
$$;

REVOKE ALL ON FUNCTION public.get_admin_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_overview() TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- B2) Admin recent activity RPC
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_recent_activity()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'latestSignups', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT id, email, full_name, tier, subscription_status, created_at, is_admin
        FROM profiles
        ORDER BY created_at DESC
        LIMIT 20
      ) t
    ),
    'latestPreps', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT ps.id, ps.user_id, p.email AS user_email,
               ps.company_name, ps.job_title, ps.generation_status, ps.ats_status, ps.created_at
        FROM prep_sessions ps
        LEFT JOIN profiles p ON p.id = ps.user_id
        ORDER BY ps.created_at DESC
        LIMIT 20
      ) t
    ),
    'latestPayments', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT pm.id, pm.user_id, p.email AS user_email,
               pm.kind, pm.amount_cents, pm.status, pm.paid_at, pm.created_at
        FROM payments pm
        LEFT JOIN profiles p ON p.id = pm.user_id
        ORDER BY pm.created_at DESC
        LIMIT 20
      ) t
    ),
    'failedPreps', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT ps.id, p.email AS user_email,
               ps.company_name, ps.error_message, ps.created_at
        FROM prep_sessions ps
        LEFT JOIN profiles p ON p.id = ps.user_id
        WHERE ps.generation_status='failed'
        ORDER BY ps.created_at DESC
        LIMIT 10
      ) t
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_admin_recent_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_recent_activity() TO service_role;
