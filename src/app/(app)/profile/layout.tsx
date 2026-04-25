import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { ProfileShellProvider } from "@/components/profile/ProfileShellProvider";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import type { ProfileShellData } from "@/lib/profile/types";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, preferred_language, tier, preps_used_this_month, avatar_url, avatar_updated_at, asaas_customer_id, subscription_status, subscription_renews_at, prep_credits, preps_reset_at",
    )
    .eq("id", auth.user.id)
    .single();

  if (!profile) redirect("/login");

  const p = profile as {
    id: string;
    email: string;
    full_name: string | null;
    preferred_language: "en" | "pt-br" | "es";
    tier: "free" | "pro" | "team";
    preps_used_this_month: number;
    avatar_url: string | null;
    avatar_updated_at: string | null;
    asaas_customer_id: string | null;
    subscription_status: "active" | "overdue" | "canceled" | "expired" | "none" | null;
    subscription_renews_at: string | null;
    prep_credits: number;
    preps_reset_at: string;
  };

  const data: ProfileShellData = {
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    preferredLanguage: p.preferred_language,
    tier: p.tier,
    prepsUsedThisMonth: p.preps_used_this_month,
    avatarPath: p.avatar_url,
    avatarUpdatedAt: p.avatar_updated_at,
    resolvedAvatarUrl: resolveAvatarUrl(
      {
        email: p.email,
        avatarPath: p.avatar_url,
        avatarUpdatedAt: p.avatar_updated_at,
      },
      supabase,
    ),
    asaasCustomerId: p.asaas_customer_id,
    subscriptionStatus: p.subscription_status ?? "none",
    subscriptionRenewsAt: p.subscription_renews_at,
    prepCredits: p.prep_credits,
    prepsResetAt: p.preps_reset_at,
  };

  return (
    <ProfileShellProvider data={data}>
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Meu perfil</h1>
        <ProfileTabs />
        <div className="pt-2">{children}</div>
      </div>
    </ProfileShellProvider>
  );
}
