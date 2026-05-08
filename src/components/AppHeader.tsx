import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvatarMenu } from "@/components/ui/AvatarMenu";
import { PlanBadge } from "@/components/billing/PlanBadge";

/**
 * Shared top-of-page header. Used by:
 * - (app)/layout.tsx (dashboard, profile, partner, etc.)
 * - prep/[id]/layout.tsx (the prep flow lives outside (app) but should
 *   render the same chrome so the user feels like they're in one app)
 *
 * Caller is responsible for fetching the props (auth, profile, billing).
 */
export function AppHeader({
  email,
  avatarUrl,
  isAdmin,
  tier,
  subscriptionStatus,
  prepsUsedThisMonth,
  prepCredits,
  logoutAction,
}: {
  email: string;
  avatarUrl: string;
  isAdmin: boolean;
  tier: "free" | "pro" | "team";
  subscriptionStatus:
    | "active"
    | "overdue"
    | "canceled"
    | "expired"
    | "none"
    | null;
  prepsUsedThisMonth: number;
  prepCredits: number;
  logoutAction: () => Promise<void>;
}) {
  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/dashboard" aria-label="PrepaVaga, ir para o painel">
          <Logo variant="horizontal" size={32} />
        </Link>
        <div className="flex items-center gap-3">
          <PlanBadge
            tier={tier}
            subscriptionStatus={subscriptionStatus}
            prepsUsedThisMonth={prepsUsedThisMonth}
            prepCredits={prepCredits}
          />
          <ThemeToggle />
          <AvatarMenu
            email={email}
            avatarUrl={avatarUrl}
            logoutAction={logoutAction}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </header>
  );
}
