import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lightweight server-side page view tracker. Called fire-and-forget from
 * an internal /api/track endpoint that the middleware POSTs to. Failure
 * is silent — analytics is cosmetic, not load-bearing.
 *
 * Bot detection is heuristic — we drop the most common crawlers so the
 * admin numbers reflect human-ish traffic. Not perfect; not trying to be.
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
  if (!userAgent) return true; // no UA = likely bot or curl
  return BOT_PATTERNS.some((p) => p.test(userAgent));
}

export async function trackPageView(opts: {
  visitorId: string;
  path: string;
  userAgent: string | null;
}): Promise<void> {
  try {
    const sb = createAdminClient();
    await sb.from("page_views").insert({
      visitor_id: opts.visitorId,
      path: opts.path,
      user_agent: opts.userAgent?.slice(0, 500) ?? null,
      is_bot: isBot(opts.userAgent),
    });
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

/**
 * Aggregate totals + uniques for admin dashboard. Filters out is_bot rows so
 * the numbers reflect human-ish traffic. One round-trip per window — small
 * tables (low row count), simple count-distinct — fine to run on every admin
 * page load.
 */
export async function getPageViewMetrics(): Promise<PageViewMetrics> {
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

  return {
    total_24h: r24h.total,
    unique_24h: r24h.unique,
    total_7d: r7d.total,
    unique_7d: r7d.unique,
    total_30d: r30d.total,
    unique_30d: r30d.unique,
    total_all_time: rAll.total,
    unique_all_time: rAll.unique,
  };
}

async function countWindow(
  sb: ReturnType<typeof createAdminClient>,
  cutoffIso: string | null,
): Promise<{ total: number; unique: number }> {
  // Build the query for human-like rows in the window.
  let query = sb.from("page_views").select("visitor_id").eq("is_bot", false);
  if (cutoffIso) query = query.gte("created_at", cutoffIso);

  const { data, error } = await query;
  if (error || !data) return { total: 0, unique: 0 };

  const total = data.length;
  const set = new Set(data.map((r) => (r as { visitor_id: string }).visitor_id));
  return { total, unique: set.size };
}
