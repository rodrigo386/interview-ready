import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvatarMenu } from "@/components/ui/AvatarMenu";
import { PlanBadge } from "@/components/billing/PlanBadge";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { reconcileBillingFromAsaas } from "@/lib/billing/reconcile";
import { logout } from "./dashboard/actions";

type BillingShape = {
  tier: "free" | "pro" | "team";
  subscription_status: "active" | "overdue" | "canceled" | "expired" | "none" | null;
  asaas_subscription_id: string | null;
  preps_used_this_month: number;
  preps_reset_at: string;
  prep_credits: number;
};

const PROFILE_COLS =
  "avatar_url, avatar_updated_at, tier, subscription_status, asaas_subscription_id, preps_used_this_month, preps_reset_at, prep_credits";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    redirect("/login");
  }

  let avatarPath: string | null = null;
  let avatarUpdatedAt: string | null = null;
  let billing: BillingShape = {
    tier: "free",
    subscription_status: null,
    asaas_subscription_id: null,
    preps_used_this_month: 0,
    preps_reset_at: new Date().toISOString(),
    prep_credits: 0,
  };

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", user.id)
      .single();
    if (profile) {
      const p = profile as Partial<BillingShape> & {
        avatar_url?: string | null;
        avatar_updated_at?: string | null;
      };
      avatarPath = p.avatar_url ?? null;
      avatarUpdatedAt = p.avatar_updated_at ?? null;
      billing = {
        tier: p.tier ?? "free",
        subscription_status: p.subscription_status ?? null,
        asaas_subscription_id: p.asaas_subscription_id ?? null,
        preps_used_this_month: p.preps_used_this_month ?? 0,
        preps_reset_at: p.preps_reset_at ?? new Date().toISOString(),
        prep_credits: p.prep_credits ?? 0,
      };
    }
  } catch (err) {
    console.warn("[(app)/layout] profile fetch failed:", err);
  }

  // Self-heal: webhook may not have delivered. If user has a subscription on
  // Asaas but our DB still shows them as not active/overdue, reconcile from
  // Asaas API. Once reconciliation succeeds, status flips to active and this
  // branch is skipped on subsequent renders.
  const looksStale =
    !!billing.asaas_subscription_id &&
    billing.subscription_status !== "active" &&
    billing.subscription_status !== "overdue";

  if (looksStale) {
    try {
      const admin = createAdminClient();
      const result = await reconcileBillingFromAsaas(user.id, admin, "subscription");
      if (result.reconciled) {
        const { data: refreshed } = await supabase
          .from("profiles")
          .select(PROFILE_COLS)
          .eq("id", user.id)
          .single();
        if (refreshed) {
          const p = refreshed as Partial<BillingShape>;
          billing = {
            tier: p.tier ?? billing.tier,
            subscription_status: p.subscription_status ?? billing.subscription_status,
            asaas_subscription_id: p.asaas_subscription_id ?? billing.asaas_subscription_id,
            preps_used_this_month: p.preps_used_this_month ?? billing.preps_used_this_month,
            preps_reset_at: p.preps_reset_at ?? billing.preps_reset_at,
            prep_credits: p.prep_credits ?? billing.prep_credits,
          };
        }
      }
    } catch (err) {
      console.warn("[(app)/layout] reconcile failed:", err);
    }
  }

  const resolvedAvatarUrl = resolveAvatarUrl(
    { email: user.email!, avatarPath, avatarUpdatedAt },
    supabase,
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" aria-label="PrepaVAGA, ir para o painel">
            <Logo variant="horizontal" size={32} />
          </Link>
          <div className="flex items-center gap-3">
            <PlanBadge
              tier={billing.tier}
              subscriptionStatus={billing.subscription_status}
              prepsUsedThisMonth={billing.preps_used_this_month}
              prepCredits={billing.prep_credits}
            />
            <ThemeToggle />
            <AvatarMenu
              email={user.email!}
              avatarUrl={resolvedAvatarUrl}
              logoutAction={logout}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
