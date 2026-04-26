import Link from "next/link";

const PLANS = [
  { label: "1ª prep grátis", sub: "ao criar sua conta" },
  { label: "R$10 por uso", sub: "1 prep avulso" },
  { label: "R$30/mês", sub: "ilimitado · promo R$50" },
];

export function PricingChips() {
  return (
    <section
      id="precos"
      className="border-t border-neutral-200 bg-bg py-20 scroll-mt-20 md:py-24 dark:border-zinc-800"
    >
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-sm font-semibold text-brand-600">Preços</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Sem mensalidade obrigatória.
        </h2>
        <p className="mt-3 text-base leading-[1.6] text-text-secondary">
          Pague só quando precisar. Ou assine e prepare quantas vagas quiser.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.label}
              className="rounded-xl border border-neutral-200 bg-bg px-5 py-4 dark:border-zinc-800"
            >
              <p className="text-base font-semibold text-text-primary">{p.label}</p>
              <p className="mt-1 text-xs text-text-tertiary">{p.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href="/pricing"
            className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline"
          >
            Ver detalhes dos planos →
          </Link>
        </div>
      </div>
    </section>
  );
}
