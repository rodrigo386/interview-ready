import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SocialProofStats = {
  prepsCompleted: number;
  professionalsPrepared: number;
};

const FALLBACK: SocialProofStats = {
  prepsCompleted: 0,
  professionalsPrepared: 0,
};

// Don't render the social proof banner below this. Weak numbers
// ("3 preparações geradas") backfire — they signal "nobody uses this".
// Above the threshold the numbers start being a positive signal.
export const SOCIAL_PROOF_MIN_PREPS = 25;

/**
 * Stats rendered on the landing to provide social proof. Counts:
 *  - prepsCompleted: total prep_sessions with generation_status = 'complete'.
 *  - professionalsPrepared: distinct user_id from those rows.
 *
 * Excludes admin accounts to avoid inflating numbers with internal testing.
 * Returns zeroes on any error so the landing never crashes on a DB blip.
 *
 * Cached at module level for 5 minutes — the landing is hit by every visitor
 * and we don't want to round-trip Supabase on every render. Stale-while-live
 * is fine for social proof.
 */
let cache: { at: number; value: SocialProofStats } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getSocialProofStats(): Promise<SocialProofStats> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }
  try {
    const sb = createAdminClient();

    // Pull admin user ids once so we can exclude them from totals.
    const { data: admins } = await sb
      .from("profiles")
      .select("id")
      .eq("is_admin", true);
    const adminIds = new Set(
      ((admins ?? []) as Array<{ id: string }>).map((r) => r.id),
    );

    const { data: rows, error } = await sb
      .from("prep_sessions")
      .select("user_id")
      .eq("generation_status", "complete");
    if (error || !rows) {
      cache = { at: Date.now(), value: FALLBACK };
      return FALLBACK;
    }

    const completed = (rows as Array<{ user_id: string }>).filter(
      (r) => !adminIds.has(r.user_id),
    );
    const value: SocialProofStats = {
      prepsCompleted: completed.length,
      professionalsPrepared: new Set(completed.map((r) => r.user_id)).size,
    };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    cache = { at: Date.now(), value: FALLBACK };
    return FALLBACK;
  }
}
