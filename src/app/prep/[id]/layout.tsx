import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { AppHeader } from "@/components/AppHeader";
import { PrepShellProvider } from "@/components/prep/PrepShellProvider";
import { PrepStepperBound } from "@/components/prep/PrepStepperBound";
import { PrepSidebar } from "@/components/prep/PrepSidebar";
import { MobileStepNav } from "@/components/prep/MobileStepNav";
import { computeServerCompleted } from "@/lib/prep/step-state";
import { PrepSkeleton } from "@/components/prep/PrepSkeleton";
import { PrepFailed } from "@/components/prep/PrepFailed";
import { loadPrepSession } from "@/lib/prep/load-session";
import { isGenerationStale } from "@/lib/prep/generation-stale";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { logout } from "@/app/(app)/dashboard/actions";

type ShellBilling = {
  tier: "free" | "pro" | "team";
  subscription_status: "active" | "overdue" | "canceled" | "expired" | "none" | null;
  preps_used_this_month: number;
  prep_credits: number;
  is_admin: boolean;
};

const PROFILE_COLS =
  "avatar_url, avatar_updated_at, tier, subscription_status, asaas_subscription_id, preps_used_this_month, preps_reset_at, prep_credits, is_admin";

export default async function PrepLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile so we can render the same chrome (PlanBadge, AvatarMenu,
  // ThemeToggle) the user sees on /dashboard. Mirrors the (app)/layout.tsx
  // loader minus the reconcile (dashboard handles that on its own — keeps
  // the prep page render fast).
  let avatarPath: string | null = null;
  let avatarUpdatedAt: string | null = null;
  let billing: ShellBilling = {
    tier: "free",
    subscription_status: null,
    preps_used_this_month: 0,
    prep_credits: 0,
    is_admin: false,
  };
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", user.id)
      .single();
    if (profile) {
      const p = profile as Partial<ShellBilling> & {
        avatar_url?: string | null;
        avatar_updated_at?: string | null;
      };
      avatarPath = p.avatar_url ?? null;
      avatarUpdatedAt = p.avatar_updated_at ?? null;
      billing = {
        tier: p.tier ?? "free",
        subscription_status: p.subscription_status ?? null,
        preps_used_this_month: p.preps_used_this_month ?? 0,
        prep_credits: p.prep_credits ?? 0,
        is_admin: p.is_admin ?? false,
      };
    }
  } catch (err) {
    console.warn("[prep/[id]/layout] profile fetch failed:", err);
  }
  const resolvedAvatarUrl = resolveAvatarUrl(
    { email: user.email!, avatarPath, avatarUpdatedAt },
    supabase,
  );

  const session = await loadPrepSession(id);
  if (!session) notFound();

  // Same shared header used on dashboard, so the user feels like they
  // never left the app.
  const headerEl = (
    <AppHeader
      email={user.email!}
      avatarUrl={resolvedAvatarUrl}
      isAdmin={billing.is_admin}
      tier={billing.tier}
      subscriptionStatus={billing.subscription_status}
      prepsUsedThisMonth={billing.preps_used_this_month}
      prepCredits={billing.prep_credits}
      logoutAction={logout}
    />
  );

  if (session.generation_status === "generating" || session.generation_status === "pending") {
    // A prep stuck "generating" past the threshold is a zombie (background job
    // died on a redeploy/crash). Show the retry UI instead of an eternal
    // skeleton so the user can recover with one click.
    if (isGenerationStale(session.generation_status, session.created_at, Date.now())) {
      return (
        <>
          {headerEl}
          <PrepFailed
            id={session.id}
            errorMessage={
              'A geração travou — provavelmente uma instabilidade temporária do serviço de IA. Clique em "Tentar novamente"; seu CV e a descrição da vaga foram preservados.'
            }
          />
        </>
      );
    }
    return (
      <>
        {headerEl}
        <PrepSkeleton
          progressStep={session.progress_step}
          companyIntelStatus={session.company_intel_status}
        />
      </>
    );
  }
  if (session.generation_status === "failed") {
    return (
      <>
        {headerEl}
        <PrepFailed id={session.id} errorMessage={session.error_message} />
      </>
    );
  }

  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) {
    return (
      <>
        {headerEl}
        <PrepFailed id={session.id} errorMessage="Stored guide is malformed." />
      </>
    );
  }

  const guideReady = true;
  const atsComplete = session.ats_status === "complete";
  const serverCompleted = computeServerCompleted({ guideReady, atsComplete });

  return (
    <>
      {headerEl}
      <PrepShellProvider
        sessionId={session.id}
        company={parsed.data.meta.company}
        role={parsed.data.meta.role}
        estimatedMinutes={parsed.data.meta.estimated_prep_time_minutes}
        serverCompleted={serverCompleted}
      >
        <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6 md:py-10">
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-prep transition hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
            >
              <span aria-hidden>←</span>
              Voltar ao Dashboard
            </Link>
          </div>
          <div className="mb-8">
            <PrepStepperBound />
          </div>
          <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
            <PrepSidebar />
            <main className="min-w-0 pb-20 lg:pb-0">{children}</main>
          </div>
          <MobileStepNav />
        </div>
      </PrepShellProvider>
    </>
  );
}
