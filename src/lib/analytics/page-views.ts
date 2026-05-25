import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Page-view tracking helpers. Inserts happen via /api/track (Node runtime),
 * called from the PageViewTracker client component on mount + route change.
 * Reads (getPageViewMetrics, getPageViewDiagnostic) serve /admin.
 */

const BOT_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /scrape/i,
  /headless/i,
  /lighthouse/i,
  /pingdom/i,
  /uptimerobot/i,
  /facebookexternalhit/i,
  /whatsapp/i,
  /twitterbot/i,
  /linkedinbot/i,
  /slackbot/i,
  /discordbot/i,
  /telegrambot/i,
];

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // no UA = likely curl/bot
  return BOT_PATTERNS.some((p) => p.test(userAgent));
}

export async function trackPageView(opts: {
  visitorId: string;
  path: string;
  userAgent: string | null;
}): Promise<void> {
  try {
    const sb = createAdminClient();
    const { error } = await sb.from("page_views").insert({
      visitor_id: opts.visitorId,
      path: opts.path,
      user_agent: opts.userAgent?.slice(0, 500) ?? null,
      is_bot: isBot(opts.userAgent),
    });
    if (error) {
      console.warn(
        `[analytics] page_views insert failed: ${error.code ?? "?"} ${error.message}`,
      );
    }
  } catch (err) {
    console.warn("[analytics] trackPageView failed:", err);
  }
}

export type PageViewMetrics = {
  total_24h: number;
  unique_24h: number;
  total_7d: number;
  unique_7d: number;
  total_30d: number;
  unique_30d: number;
  total_all_time: number;
  unique_all_time: number;
};

export type PageViewMetricsResult =
  | { ok: true; metrics: PageViewMetrics }
  | { ok: false; reason: "table_missing" | "query_failed"; detail: string };

/**
 * Aggregate totals + uniques for admin dashboard. Filters out is_bot rows so
 * the numbers reflect human-ish traffic. One round-trip per window — small
 * tables (low row count), simple count-distinct — fine to run on every admin
 * page load.
 *
 * Returns a discriminated union so the admin page can show useful diagnostics
 * (e.g. "table missing — did you run migration 0018?") instead of silently
 * showing zeros.
 */
export async function getPageViewMetrics(): Promise<PageViewMetricsResult> {
  try {
    const sb = createAdminClient();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const cutoff24h = new Date(now - day).toISOString();
    const cutoff7d = new Date(now - 7 * day).toISOString();
    const cutoff30d = new Date(now - 30 * day).toISOString();

    const [r24h, r7d, r30d, rAll] = await Promise.all([
      countWindow(sb, cutoff24h),
      countWindow(sb, cutoff7d),
      countWindow(sb, cutoff30d),
      countWindow(sb, null),
    ]);

    // If any window failed, surface the first error so the admin page can
    // show a real diagnostic instead of zero counts.
    const firstErr = [r24h, r7d, r30d, rAll].find((r) => r.error);
    if (firstErr?.error) {
      const code = (firstErr.error as { code?: string }).code;
      // Postgres "relation does not exist" → migration not applied.
      if (code === "42P01") {
        return {
          ok: false,
          reason: "table_missing",
          detail: firstErr.error.message ?? "page_views table not found",
        };
      }
      return {
        ok: false,
        reason: "query_failed",
        detail: firstErr.error.message ?? "unknown query error",
      };
    }

    return {
      ok: true,
      metrics: {
        total_24h: r24h.total,
        unique_24h: r24h.unique,
        total_7d: r7d.total,
        unique_7d: r7d.unique,
        total_30d: r30d.total,
        unique_30d: r30d.unique,
        total_all_time: rAll.total,
        unique_all_time: rAll.unique,
      },
    };
  } catch (err) {
    return {
      ok: false,
      reason: "query_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function countWindow(
  sb: ReturnType<typeof createAdminClient>,
  cutoffIso: string | null,
): Promise<{ total: number; unique: number; error: { code?: string; message?: string } | null }> {
  let query = sb.from("page_views").select("visitor_id").eq("is_bot", false);
  if (cutoffIso) query = query.gte("created_at", cutoffIso);

  const { data, error } = await query;
  if (error) return { total: 0, unique: 0, error };
  if (!data) return { total: 0, unique: 0, error: null };

  const total = data.length;
  const set = new Set(data.map((r) => (r as { visitor_id: string }).visitor_id));
  return { total, unique: set.size, error: null };
}

export type PageViewDiagnostic = {
  totalRowsAllTime: number;
  totalRowsLastHour: number;
  botRows: number;
  humanRows: number;
  latestRows: Array<{
    path: string;
    is_bot: boolean;
    user_agent_truncated: string | null;
    created_at: string;
  }>;
};

/**
 * Raw diagnostic data — ignores is_bot filter and shows the 5 most recent
 * rows so admin can see if writes are reaching the table at all and whether
 * the bot detection is over-flagging.
 *
 * Surfaced in /admin under the "Diagnóstico de tracking" section to make
 * silent failures debuggable without digging through Railway logs.
 */
export async function getPageViewDiagnostic(): Promise<PageViewDiagnostic | null> {
  try {
    const sb = createAdminClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [allRes, lastHourRes, latestRes] = await Promise.all([
      sb.from("page_views").select("is_bot"),
      sb
        .from("page_views")
        .select("id", { count: "exact", head: true })
        .gte("created_at", oneHourAgo),
      sb
        .from("page_views")
        .select("path, is_bot, user_agent, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (allRes.error) return null;

    const rows = (allRes.data ?? []) as Array<{ is_bot: boolean }>;
    const botRows = rows.filter((r) => r.is_bot).length;
    const humanRows = rows.length - botRows;

    return {
      totalRowsAllTime: rows.length,
      totalRowsLastHour: lastHourRes.count ?? 0,
      botRows,
      humanRows,
      latestRows: ((latestRes.data ?? []) as Array<{
        path: string;
        is_bot: boolean;
        user_agent: string | null;
        created_at: string;
      }>).map((r) => ({
        path: r.path,
        is_bot: r.is_bot,
        user_agent_truncated: r.user_agent ? r.user_agent.slice(0, 80) : null,
        created_at: r.created_at,
      })),
    };
  } catch {
    return null;
  }
}

export type PathBreakdownRow = {
  path: string;
  views: number;
  uniqueVisitors: number;
};

/**
 * Top entry paths in the last 30 days (human traffic only). Lets admin see
 * the funnel composition — e.g. 80% of traffic landing on article pages
 * means we need stronger article→signup CTAs, not landing optimization.
 */
export async function getPageViewPathBreakdown(): Promise<PathBreakdownRow[] | null> {
  try {
    const sb = createAdminClient();
    const cutoff30d = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await sb
      .from("page_views")
      .select("path, visitor_id")
      .eq("is_bot", false)
      .gte("created_at", cutoff30d);
    if (error || !data) return null;

    const byPath = new Map<string, { views: number; visitors: Set<string> }>();
    for (const r of data as Array<{ path: string; visitor_id: string }>) {
      // Collapse article slugs into a single bucket so the breakdown isn't
      // diluted across 15+ rows. Keep landing and core funnel pages distinct.
      const key = normalizePath(r.path);
      const entry = byPath.get(key) ?? { views: 0, visitors: new Set() };
      entry.views += 1;
      entry.visitors.add(r.visitor_id);
      byPath.set(key, entry);
    }
    return Array.from(byPath.entries())
      .map(([path, e]) => ({
        path,
        views: e.views,
        uniqueVisitors: e.visitors.size,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);
  } catch {
    return null;
  }
}

function normalizePath(path: string): string {
  // Group all article reads under one row, keep slug visible for top 3.
  // Otherwise the breakdown gets dominated by 1-view-each article rows
  // and you can't see the landing vs articles ratio at a glance.
  if (path.startsWith("/artigos/") && path !== "/artigos/") {
    return path; // keep article-level detail; sort will surface top ones
  }
  return path;
}
