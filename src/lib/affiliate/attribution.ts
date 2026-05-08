import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateCode } from "./code";

export type AttributionResult =
  | { attributed: true; partnerId: string; flagged: boolean; flagReason?: string }
  | {
      attributed: false;
      reason:
        | "invalid_code"
        | "code_not_found"
        | "self_referral"
        | "already_attributed"
        | "error";
    };

// Generic email providers — a partner and a referred user sharing one of
// these domains is meaningless (both have @gmail.com is normal). For any
// other shared domain (corporate, custom), it's a fraud signal.
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.com.br",
  "hotmail.com",
  "hotmail.com.br",
  "live.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
  "msn.com",
  "protonmail.com",
  "proton.me",
]);

function normalizeCpfCnpj(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

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

  // Hard block: partner using their own code on their own account.
  if (partner.user_id === profileId) {
    return { attributed: false, reason: "self_referral" };
  }

  // Stronger self-referral block: same CPF/CNPJ between partner and
  // referred user means the same human (under Brazilian law, CPFs are
  // 1:1 with people). Common abuse: partner creates a second account
  // with their own CPF to self-refer. Treat as self_referral, not flag.
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

  const refCpf = normalizeCpfCnpj(refereeProfile?.cpf_cnpj);
  const partnerCpf = normalizeCpfCnpj(partnerProfile?.cpf_cnpj);
  if (refCpf && partnerCpf && refCpf === partnerCpf) {
    return { attributed: false, reason: "self_referral" };
  }

  // Hard block: identical email — partner created duplicate account with
  // the same email (case-insensitive comparison).
  const refEmail = refereeProfile?.email?.toLowerCase().trim() ?? "";
  const partnerEmail = partnerProfile?.email?.toLowerCase().trim() ?? "";
  if (refEmail && partnerEmail && refEmail === partnerEmail) {
    return { attributed: false, reason: "self_referral" };
  }

  // Soft flag: same email domain when it's NOT a generic provider.
  // A custom/corporate domain shared between partner and referee is
  // unusual and worth manual review — but not auto-blocked since
  // legitimate cases exist (e.g. internal team members).
  const flags: string[] = [];
  const refDomain = refEmail.split("@")[1];
  const partnerDomain = partnerEmail.split("@")[1];
  if (
    refDomain &&
    partnerDomain &&
    refDomain === partnerDomain &&
    !GENERIC_EMAIL_DOMAINS.has(refDomain)
  ) {
    flags.push("same_corporate_email_domain");
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
