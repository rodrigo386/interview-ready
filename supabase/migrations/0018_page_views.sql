-- Migration 0018: Lightweight page-view tracking
-- Used by /admin to display total + unique visitor counts. Not a replacement
-- for full analytics (Plausible) — just enough to gauge growth without an
-- external dep.
--
-- Volume estimate: ~100 page views/day at current scale → 36k rows/year.
-- Trivial for Postgres. Cleanup task is left for future when volume grows.

CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  path TEXT NOT NULL,
  user_agent TEXT,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for the two queries the admin card runs:
-- 1. WHERE created_at >= now() - interval 'X days' GROUP BY date — total counts
-- 2. SELECT COUNT(DISTINCT visitor_id) WHERE created_at >= ... — unique counts
CREATE INDEX IF NOT EXISTS idx_page_views_created
  ON public.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_created
  ON public.page_views(visitor_id, created_at DESC);

-- RLS: this table is server-write only, admin-read only.
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
-- No policy for `authenticated` — service_role inserts via admin client,
-- admin reads via /admin (also via service_role). Regular users have no
-- access (and there's no PII in this table beyond visitor_id which is
-- a random UUID stored in a cookie, not linked to auth.users).
