import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  /** % vs the previous stage. 100 for the first stage. */
  conversionFromPrev: number;
  /** % vs the first stage (overall funnel rate). */
  conversionFromTop: number;
  hint?: string;
};

/**
 * Aggregates the conversion funnel from raw signup attempt → paying user.
 * Stages are computed over all-time data so the small numbers (4 users today)
 * have any chance of being interpretable. Once volume grows, add a 30d window.
 *
 * Stage definitions intentionally avoid joining auth.users to profiles via
 * id — profiles get inserted by a trigger on signup, so the two counts
 * should match unless the trigger failed (in which case the gap itself is
 * the diagnostic).
 *
 * Excludes admin users (is_admin=true) from every stage so the funnel
 * reflects organic conversion, not internal seeding.
 */
export async function getConversionFunnel(): Promise<FunnelStage[] | null> {
  try {
    const sb = createAdminClient();

    // 1. Signup attempts: every row in auth.users (regardless of email
    //    confirmation). Use admin auth.listUsers for accurate count.
    const { data: authData, error: authErr } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authErr) return null;
    const authUsers = authData.users ?? [];

    // 2. Profiles (post-confirmation row created by trigger). is_admin flag
    //    used to exclude internal accounts from the funnel.
    const { data: profiles } = await sb
      .from("profiles")
      .select(
        "id, is_admin, tier, subscription_status, preps_used_this_month, prep_credits",
      );
    const allProfiles = (profiles ?? []) as Array<{
      id: string;
      is_admin: boolean;
      tier: "free" | "pro" | "team";
      subscription_status: string | null;
      preps_used_this_month: number;
      prep_credits: number;
    }>;
    const adminIds = new Set(allProfiles.filter((p) => p.is_admin).map((p) => p.id));

    // Filter signups + profiles to non-admin
    const organicSignups = authUsers.filter((u) => !adminIds.has(u.id));
    const confirmedSignups = organicSignups.filter(
      (u) => !!u.email_confirmed_at,
    );
    const organicProfiles = allProfiles.filter((p) => !p.is_admin);

    // 3. Users who generated at least one prep (distinct user_id in prep_sessions
    //    with successful generation). Excludes admins.
    const { data: prepUsers } = await sb
      .from("prep_sessions")
      .select("user_id")
      .eq("generation_status", "complete");
    const activatedSet = new Set(
      ((prepUsers ?? []) as Array<{ user_id: string }>)
        .map((r) => r.user_id)
        .filter((id) => !adminIds.has(id)),
    );

    // 4. Paying users: tier=pro AND subscription_status=active. Excludes admins.
    const paying = organicProfiles.filter(
      (p) => p.tier === "pro" && p.subscription_status === "active",
    );

    const stages: Array<Omit<FunnelStage, "conversionFromPrev" | "conversionFromTop">> = [
      {
        key: "signup_attempts",
        label: "Tentativas de cadastro",
        count: organicSignups.length,
        hint: "Rows em auth.users (excluindo admins)",
      },
      {
        key: "email_confirmed",
        label: "Confirmaram email",
        count: confirmedSignups.length,
        hint: "auth.users.email_confirmed_at IS NOT NULL",
      },
      {
        key: "profile_active",
        label: "Conta ativa (perfil criado)",
        count: organicProfiles.length,
        hint: "Row em profiles (trigger pós-confirmação)",
      },
      {
        key: "activated_prep",
        label: "Geraram 1+ prep com sucesso",
        count: activatedSet.size,
        hint: "Distintos user_id em prep_sessions completas",
      },
      {
        key: "paying",
        label: "Pagantes (Pro ativo)",
        count: paying.length,
        hint: "tier=pro AND subscription_status=active",
      },
    ];

    const top = stages[0].count || 1; // avoid /0
    return stages.map((s, i) => {
      const prev = i === 0 ? s.count : stages[i - 1].count;
      // Cap at 100% — `paying` can exceed `activated_prep` (someone pays
      // before generating a prep, especially in test/seeded accounts). The
      // funnel display reads cleaner if we never show >100% conversion.
      const rawConv = prev > 0 ? (s.count / prev) * 100 : 0;
      const conversionFromPrev = Math.min(100, rawConv);
      const conversionFromTop = Math.min(100, (s.count / top) * 100);
      return {
        ...s,
        conversionFromPrev: Math.round(conversionFromPrev * 10) / 10,
        conversionFromTop: Math.round(conversionFromTop * 10) / 10,
      };
    });
  } catch {
    return null;
  }
}
