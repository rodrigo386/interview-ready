import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateCode } from "./code";

export type AttributionResult =
  | { attributed: true; partnerId: string; flagged: boolean; flagReason?: string }
  | { attributed: false; reason: "invalid_code" | "code_not_found" | "self_referral" | "already_attributed" | "error" };

export async function attachReferral(
  profileId: string,
  refCode: string | null | undefined,
  supabase: SupabaseClient,
): Promise<AttributionResult> {
  if (!validateCode(refCode)) {
    return { attributed: false, reason: "invalid_code" };
  }

  const { data: existing } = await supabase
    .from("affiliate_referrals")
    .select("partner_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existing) {
    return { attributed: false, reason: "already_attributed" };
  }

  const { data: partner, error: pErr } = await supabase
    .from("affiliate_partners")
    .select("id, user_id")
    .eq("code", refCode!)
    .eq("status", "active")
    .maybeSingle();
  if (pErr) return { attributed: false, reason: "error" };
  if (!partner) return { attributed: false, reason: "code_not_found" };

  if (partner.user_id === profileId) {
    return { attributed: false, reason: "self_referral" };
  }

  const flags: string[] = [];
  const { data: refereeProfile } = await supabase
    .from("profiles")
    .select("email, cpf_cnpj")
    .eq("id", profileId)
    .single();
  const { data: partnerProfile } = await supabase
    .from("profiles")
    .select("email, cpf_cnpj")
    .eq("id", partner.user_id)
    .single();
  if (refereeProfile && partnerProfile) {
    const refDomain = refereeProfile.email?.split("@")[1];
    const partnerDomain = partnerProfile.email?.split("@")[1];
    if (refDomain && partnerDomain && refDomain === partnerDomain) {
      flags.push("same_email_domain");
    }
    if (
      refereeProfile.cpf_cnpj &&
      partnerProfile.cpf_cnpj &&
      refereeProfile.cpf_cnpj === partnerProfile.cpf_cnpj
    ) {
      flags.push("same_cpf");
    }
  }

  const flagged = flags.length > 0;
  const flagReason = flagged ? flags.join(",") : null;

  const { error: insErr } = await supabase.from("affiliate_referrals").insert({
    profile_id: profileId,
    partner_id: partner.id,
    flagged_for_review: flagged,
    flag_reason: flagReason,
  });

  if (insErr) return { attributed: false, reason: "error" };

  return {
    attributed: true,
    partnerId: partner.id,
    flagged,
    flagReason: flagReason ?? undefined,
  };
}
