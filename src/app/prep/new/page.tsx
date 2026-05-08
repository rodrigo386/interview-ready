import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { logout } from "@/app/(app)/dashboard/actions";
import { NewPrepForm } from "@/components/prep/NewPrepForm";

type ProfileShape = {
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

const PROFILE_COLS =
  "avatar_url, avatar_updated_at, tier, subscription_status, preps_used_this_month, prep_credits, is_admin";

export default async function NewPrepPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: cvs }, { data: profileRaw }] = await Promise.all([
    supabase
      .from("cvs")
      .select("id, file_name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("profiles").select(PROFILE_COLS).eq("id", user.id).single(),
  ]);

  const profile = (profileRaw ?? {}) as Partial<ProfileShape>;
  const avatarUrl = resolveAvatarUrl(
    {
      email: user.email!,
      avatarPath: profile.avatar_url ?? null,
      avatarUpdatedAt: profile.avatar_updated_at ?? null,
    },
    supabase,
  );

  return (
    <div className="min-h-screen">
      <AppHeader
        email={user.email!}
        avatarUrl={avatarUrl}
        isAdmin={profile.is_admin ?? false}
        tier={profile.tier ?? "free"}
        subscriptionStatus={profile.subscription_status ?? null}
        prepsUsedThisMonth={profile.preps_used_this_month ?? 0}
        prepCredits={profile.prep_credits ?? 0}
        logoutAction={logout}
      />

      <section className="mx-auto max-w-3xl px-6 pt-12 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
          Novo prep
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-text-primary md:text-5xl">
          Entre na entrevista{" "}
          <span className="text-orange-500">como se já trabalhasse lá</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-text-secondary md:text-lg">
          Conte sobre a vaga e seu CV. Em cerca de 60 segundos, você recebe um
          dossiê com perguntas prováveis, contexto da empresa e um CV otimizado.
        </p>

        <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-muted">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="text-green-500">
              ●
            </span>
            ATS score com pontos críticos
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="text-orange-500">
              ●
            </span>
            Perguntas em 3 níveis de profundidade
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="text-yellow-500">
              ●
            </span>
            Pesquisa atualizada da empresa
          </li>
        </ul>
      </section>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <NewPrepForm existingCvs={cvs ?? []} />
      </main>
    </div>
  );
}
