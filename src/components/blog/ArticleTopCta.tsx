import Link from "next/link";

/**
 * Faixa curta logo abaixo do cabeçalho do artigo. O primeiro CTA do corpo só
 * aparece no meio do texto, e quem sai antes disso não via nenhum. Discreta de
 * propósito: uma linha, sem prometer mais do que a ferramenta entrega.
 */
export function ArticleTopCta() {
  return (
    <aside
      aria-label="Analise seu currículo grátis"
      className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/40 bg-orange-soft/40 px-4 py-3"
    >
      <p className="text-sm text-ink-2">
        <strong className="text-ink">Quer saber se o seu currículo passa no ATS?</strong>{" "}
        Veja o score em segundos, sem cadastro.
      </p>
      <Link
        href="/analise-ats-gratis"
        data-analytics-cta="article_top"
        className="inline-flex items-center gap-1 rounded-pill bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
      >
        Analisar grátis <span aria-hidden>→</span>
      </Link>
    </aside>
  );
}
