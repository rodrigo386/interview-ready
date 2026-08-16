import Link from "next/link";

/**
 * Inline CTA injected mid-content on /artigos/[slug]. Rendered between the
 * first and second half of the MDX content (split heuristic in the page).
 * Reason: the existing footer CTA at the bottom of articles only converts
 * readers who scrolled the whole way. Mid-content captures the ~50% who
 * bounce before finishing.
 *
 * Styled to be visually distinct from article paragraphs (orange border +
 * soft fill) but not aggressive — looks like an editorial callout, not an ad.
 */
const COPY = {
  default: {
    kicker: "Aplicar isso na sua próxima entrevista",
    heading: (
      <>
        Em 60 segundos, um dossiê pronto pra <em>sua</em> vaga
      </>
    ),
    body: (
      <>
        Cola o link da vaga + seu CV. A gente devolve análise ATS, pesquisa
        recente da empresa e roteiros prontos pra cada pergunta.{" "}
        <strong>Primeira preparação grátis e vitalícia. Sem cartão.</strong>
      </>
    ),
    cta: "Criar minha preparação grátis",
    href: "/signup",
  },
  // A variante `ats` leva pra ferramenta anônima (/analise-ats-gratis), que
  // entrega score + o principal ajuste sem cadastro. Ela NÃO reescreve o CV —
  // "CV reescrito para anônimos" é não-objetivo explícito da spec da
  // ferramenta. Prometer isso aqui faria o destino do botão entregar menos do
  // que o texto logo acima dele.
  ats: {
    kicker: "Teste com o seu currículo",
    heading: (
      <>
        Descubra se o <em>seu</em> currículo passa no ATS desta vaga
      </>
    ),
    body: (
      <>
        Cola a descrição da vaga + seu CV. A gente devolve o score ATS e o
        ajuste que mais está te barrando.{" "}
        <strong>Na hora, sem cadastro e sem cartão.</strong>
      </>
    ),
    cta: "Analisar meu currículo grátis",
    href: "/analise-ats-gratis",
  },
} as const;

export type ArticleCtaVariant = keyof typeof COPY;

export function ArticleInlineCta({
  variant = "default",
}: {
  variant?: ArticleCtaVariant;
}) {
  const copy = COPY[variant];
  return (
    <aside
      aria-label="Crie sua preparação grátis"
      className="not-prose my-10 rounded-2xl border-2 border-orange-500 bg-orange-soft/40 p-5 shadow-prep sm:p-6"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700">
        {copy.kicker}
      </p>
      <h3 className="mt-1 text-lg font-bold text-ink sm:text-xl">
        {copy.heading}
      </h3>
      <p className="mt-2 text-sm leading-snug text-ink-2 sm:text-base">
        {copy.body}
      </p>
      <div className="mt-4">
        <Link
          href={copy.href}
          className="inline-flex items-center gap-2 rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
        >
          {copy.cta}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </aside>
  );
}
