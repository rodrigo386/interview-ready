import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileBillingFromAsaas } from "@/lib/billing/reconcile";
import { Button } from "@/components/ui/Button";

const BENEFITS: { icon: string; title: string; body: string }[] = [
  {
    icon: "∞",
    title: "Preps ilimitados",
    body: "Sem limite de 1 prep a cada 30 dias. Prepare quantas vagas quiser.",
  },
  {
    icon: "🔍",
    title: "Pesquisa de empresa em tempo real",
    body: "Notícias recentes, contexto estratégico e perguntas inteligentes geradas por IA.",
  },
  {
    icon: "📄",
    title: "ATS + CV reescrito",
    body: "Análise determinística do seu CV contra a vaga e versão otimizada pronta pra colar no LinkedIn.",
  },
  {
    icon: "🎯",
    title: "Roteiros personalizados",
    body: "Perguntas básicas, aprofundamento e o que você pergunta, todos adaptados ao seu CV e à empresa.",
  },
  {
    icon: "📥",
    title: "Exportação em PDF",
    body: "Leve seu prep impresso pra qualquer lugar: offline e pronto pra revisar antes da entrevista.",
  },
];

export default async function WelcomeProPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let isPro = false;
  try {
    const admin = createAdminClient();
    await reconcileBillingFromAsaas(user.id, admin, "full");
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier, subscription_status")
      .eq("id", user.id)
      .single();
    const p = profile as
      | { tier?: string; subscription_status?: string | null }
      | null;
    isPro =
      p?.tier === "pro" &&
      (p.subscription_status === "active" || p.subscription_status === "overdue");
  } catch (err) {
    console.warn("[welcome/pro] reconcile failed:", err);
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="rounded-2xl border border-green-soft bg-green-soft/40 px-6 py-10 text-center shadow-prep dark:border-green-900 dark:bg-green-950/30">
        <div
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-2xl text-white shadow-md"
        >
          ✓
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          Bem-vindo ao{" "}
          <span className="text-green-700 dark:text-green-300">PrepaVAGA Pro</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-text-secondary">
          Obrigado pela confiança! Seu pagamento foi confirmado e sua assinatura já está ativa.
          Agora você tem acesso ilimitado a tudo que a plataforma oferece.
        </p>
        {!isPro && (
          <p className="mx-auto mt-3 max-w-xl rounded-md border border-orange-soft bg-orange-soft/60 px-4 py-2 text-sm text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300">
            Estamos confirmando seu pagamento com o Asaas. Pode levar alguns segundos. Recarregue a página caso o badge ainda apareça como Free.
          </p>
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-text-primary">Tudo isso destravado:</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <li
              key={b.title}
              className="flex gap-3 rounded-xl border border-border bg-bg p-4"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-soft text-base text-green-700 dark:bg-green-950/40 dark:text-green-300"
              >
                {b.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">{b.title}</p>
                <p className="mt-1 text-sm text-text-secondary">{b.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/prep/new">
          <Button size="lg">Criar meu próximo prep</Button>
        </Link>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
        >
          Ir para o painel
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-text-tertiary">
        Você pode gerenciar ou cancelar sua assinatura a qualquer momento em{" "}
        <Link href="/profile/account" className="underline-offset-4 hover:underline">
          Meu perfil → Conta
        </Link>
        .
      </p>
    </div>
  );
}
