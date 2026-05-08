import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { AppHeader } from "@/components/AppHeader";
import { PartnerForm } from "@/components/affiliate/PartnerForm";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { logout } from "@/app/(app)/dashboard/actions";

const PROFILE_COLS =
  "full_name, avatar_url, avatar_updated_at, tier, subscription_status, preps_used_this_month, prep_credits, is_admin";

type ProfileShape = {
  full_name: string | null;
  avatar_url: string | null;
  avatar_updated_at: string | null;
  tier: "free" | "pro" | "team";
  subscription_status:
    | "active"
    | "overdue"
    | "canceled"
    | "expired"
    | "none"
    | null;
  preps_used_this_month: number;
  prep_credits: number;
  is_admin: boolean;
};

export const metadata: Metadata = {
  title: "Programa de Parceiros — 30% recorrente vitalício",
  description:
    "Vire parceiro PrepaVAGA. 30% recorrente vitalício sobre cada cliente que você indicar. Pra coaches, recrutadores, criadores de conteúdo de carreira.",
  alternates: { canonical: "/parceiros" },
  openGraph: {
    title: "Programa de Parceiros · PrepaVAGA",
    description:
      "30% recorrente vitalício pra coaches, recrutadores e criadores de conteúdo de carreira.",
    url: "/parceiros",
  },
};

export default async function ParceirosPage() {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  const user = data.user;
  const isLoggedIn = !!user;

  // If user already applied (any status), send them to the partner dashboard.
  // /partner handles pending/active/suspended/rejected with status-aware UI.
  if (isLoggedIn) {
    const { data: existing } = await sb
      .from("affiliate_partners")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (existing) redirect("/partner");
  }

  let defaultName = "";
  let profile: Partial<ProfileShape> = {};
  if (isLoggedIn) {
    const { data: profileRaw } = await sb
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", user!.id)
      .single();
    profile = (profileRaw ?? {}) as Partial<ProfileShape>;
    defaultName = profile.full_name ?? "";
  }

  const avatarUrl = isLoggedIn
    ? resolveAvatarUrl(
        {
          email: user!.email!,
          avatarPath: profile.avatar_url ?? null,
          avatarUpdatedAt: profile.avatar_updated_at ?? null,
        },
        sb,
      )
    : "";

  return (
    <>
      {isLoggedIn ? (
        <AppHeader
          email={user!.email!}
          avatarUrl={avatarUrl}
          isAdmin={profile.is_admin ?? false}
          tier={profile.tier ?? "free"}
          subscriptionStatus={profile.subscription_status ?? null}
          prepsUsedThisMonth={profile.preps_used_this_month ?? 0}
          prepCredits={profile.prep_credits ?? 0}
          logoutAction={logout}
        />
      ) : (
        <LandingNavbar />
      )}
      <main className="bg-bg">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-tertiary">
            <Link href="/" className="hover:text-text-primary hover:underline">
              Início
            </Link>
            <span aria-hidden className="mx-2">›</span>
            <span aria-current="page" className="text-text-primary">
              Parceiros
            </span>
          </nav>

          <header className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Programa de Parceiros
            </p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
              Indique e ganhe 30% recorrente vitalício
            </h1>
            <p className="mt-4 text-lg text-ink-2">
              Pra cada cliente Pro que você trouxer (R$ 30/mês), você ganha R$ 9
              todo mês — enquanto eles forem clientes. Sem teto, sem prazo.
            </p>
          </header>

          <section className="mt-14 grid gap-8 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                Pra quem
              </p>
              <p className="mt-2 text-sm text-ink-2">
                Career coaches, recrutadores, RH consultants, criadores de
                conteúdo de carreira no LinkedIn, IG, TikTok ou YouTube.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                Como funciona
              </p>
              <p className="mt-2 text-sm text-ink-2">
                Você aplica → aprovamos em até 7 dias → divulga seu link único
                → ganha 30% sobre cada pagamento dos clientes que vieram pelo
                seu link, vitalício.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                Pagamento
              </p>
              <p className="mt-2 text-sm text-ink-2">
                Pix automático na sua chave cadastrada quando o saldo atingir{" "}
                <strong>R$ 100,00</strong>. Comissões liberam 7 dias após o
                pagamento do cliente (janela de reembolso).
              </p>
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-2xl font-bold text-ink">Aplicar</h2>
            {!isLoggedIn ? (
              <div className="mt-4 rounded-xl border-2 border-orange-500 bg-orange-soft/30 p-6">
                <p className="text-sm text-ink-2">
                  Você precisa estar logado pra aplicar.{" "}
                  <a
                    href="/signup?next=/parceiros"
                    className="font-semibold text-orange-700 underline"
                  >
                    Criar conta grátis
                  </a>{" "}
                  ou{" "}
                  <a
                    href="/login?next=/parceiros"
                    className="font-semibold text-orange-700 underline"
                  >
                    entrar
                  </a>
                  .
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <PartnerForm defaultName={defaultName} />
              </div>
            )}
          </section>
        </div>
      </main>
      {!isLoggedIn && <LandingFooter />}
    </>
  );
}
