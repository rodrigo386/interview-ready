import Link from "next/link";

type Plan = {
  label: string;
  sub: string;
  badge?: string;
};

const PLANS: Plan[] = [
  { label: "Análise ATS", sub: "grátis, com ou sem cadastro", badge: "Sempre grátis" },
  { label: "R$10", sub: "1 preparação completa" },
  { label: "R$25 · R$40", sub: "pacote de 3 ou 5 preps" },
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
          Sem mensalidade. Pague só pela preparação que usar.
        </h2>
        <p className="mt-3 text-base leading-[1.6] text-text-secondary">
          A análise ATS é sempre grátis. A preparação completa custa R$10, ou menos por vaga
          em pacote.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.label}
              className={
                "relative rounded-xl border bg-bg px-5 py-4 " +
                (p.badge
                  ? "border-orange-500"
                  : "border-neutral-200 dark:border-zinc-800")
              }
            >
              {p.badge ? (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill bg-orange-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {p.badge}
                </span>
              ) : null}
              <p className="text-base font-semibold text-text-primary">{p.label}</p>
              <p className="mt-1 text-xs text-text-tertiary">{p.sub}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-text-tertiary">
          Créditos comprados não expiram. Sem renovação automática. Reembolso
          total em até 7 dias.
        </p>

        <div className="mt-8">
          <Link
            href="/pricing"
            className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline"
          >
            Ver detalhes dos preços →
          </Link>
        </div>
      </div>
    </section>
  );
}
