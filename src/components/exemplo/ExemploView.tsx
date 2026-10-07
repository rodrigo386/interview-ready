import Link from "next/link";
import type { ReactNode } from "react";
import {
  EXEMPLO_PRINCIPAL,
  EXEMPLOS,
  type CorPergunta,
  type Exemplo,
  type Nivel,
} from "@/lib/exemplos/data";

/** Classes literais (não montadas por string) para o Tailwind enxergar todas. */
const NIVEL: Record<Nivel, { card: string; rotulo: string }> = {
  Crítico: {
    card: "border border-red-soft bg-red-soft/40",
    rotulo: "text-red-500",
  },
  Alto: {
    card: "border border-yellow-soft bg-yellow-soft/40",
    rotulo: "text-yellow-700",
  },
  Médio: { card: "border border-line bg-bg", rotulo: "text-ink-3" },
};

const PERGUNTA: Record<CorPergunta, { borda: string; tipo: string }> = {
  orange: { borda: "border-orange-500", tipo: "text-orange-700" },
  yellow: { borda: "border-yellow-500", tipo: "text-yellow-700" },
  green: { borda: "border-green-500", tipo: "text-green-700" },
};

function faixaDoScore(score: number) {
  if (score <= 40) return { fundo: "bg-red-soft", texto: "text-red-500" };
  if (score <= 70) return { fundo: "bg-yellow-soft", texto: "text-yellow-700" };
  return { fundo: "bg-green-soft", texto: "text-green-700" };
}

/** Converte **destaque** em <strong>, sem dangerouslySetInnerHTML. */
function comDestaque(texto: string): ReactNode[] {
  return texto
    .split("**")
    .map((parte, i) => (i % 2 === 1 ? <strong key={i}>{parte}</strong> : parte));
}

function hrefDo(e: Exemplo) {
  return e.slug ? `/exemplo/${e.slug}` : "/exemplo";
}

/**
 * Página "veja antes de criar conta". Serve ao /exemplo (marketing) e a cada
 * /exemplo/[slug]. Dados sempre fictícios — ver lib/exemplos/data.ts.
 */
export function ExemploView({ exemplo }: { exemplo: Exemplo }) {
  const faixa = faixaDoScore(exemplo.score);
  const todos = [EXEMPLO_PRINCIPAL, ...EXEMPLOS];

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-6">
      <header className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
          Exemplo de preparação
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
          Isso é o que você recebe em minutos
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-[1.6] text-ink-2">
          Abaixo, uma versão condensada de uma preparação gerada pela
          plataforma. A sua é feita pra <strong>vaga real</strong> que você colar
          e pro <strong>seu CV</strong>.
        </p>
        <p className="mt-3 text-xs text-ink-3">
          Vaga, empresa, números e faixa salarial deste exemplo são ilustrativos.
        </p>
      </header>

      <nav aria-label="Exemplos por área" className="mt-8">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
          Veja o exemplo da sua área
        </p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {todos.map((e) => {
            const atual = e.slug === exemplo.slug;
            return (
              <li key={e.slug || "principal"}>
                <Link
                  href={hrefDo(e)}
                  aria-current={atual ? "page" : undefined}
                  className={
                    atual
                      ? "inline-block rounded-pill bg-orange-500 px-3.5 py-1.5 text-sm font-semibold text-white"
                      : "inline-block rounded-pill border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-ink-2 transition hover:border-orange-500 hover:text-ink"
                  }
                >
                  {e.area}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="mt-10 rounded-2xl border border-line bg-white p-6 shadow-prep">
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
          A vaga do exemplo
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink">{exemplo.cargo}</h2>
        <p className="mt-1 text-sm text-ink-2">
          {exemplo.empresa} — {exemplo.contexto}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-orange-soft/40 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-orange-700">
              Pesquisa da empresa
            </p>
            <p className="mt-1.5 text-sm leading-[1.6] text-ink-2">
              {exemplo.pesquisa}
            </p>
          </div>
          <div className="rounded-xl bg-green-soft/50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-green-700">
              Faixa salarial estimada
            </p>
            <p className="mt-1.5 text-2xl font-extrabold text-ink">
              {exemplo.salario.faixa}
            </p>
            <p className="text-sm text-ink-2">{exemplo.salario.detalhe}</p>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-prep">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
              Etapa 2 · Análise ATS
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink">
              Seu currículo vs. esta vaga
            </h2>
          </div>
          <div className={`flex items-baseline gap-1 rounded-xl px-4 py-2 ${faixa.fundo}`}>
            <span className={`text-3xl font-extrabold ${faixa.texto}`}>
              {exemplo.score}
            </span>
            <span className={`text-sm font-semibold ${faixa.texto}`}>/100</span>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {exemplo.ats.map((item) => (
            <li
              key={item.texto}
              className={`rounded-xl p-4 ${NIVEL[item.nivel].card}`}
            >
              <p
                className={`text-xs font-bold uppercase tracking-wide ${NIVEL[item.nivel].rotulo}`}
              >
                {item.nivel}
              </p>
              <p className="mt-1 text-sm leading-[1.6] text-ink-2">
                {comDestaque(item.texto)}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-3">
          Na plataforma, você ainda recebe o CV reescrito com essas correções,
          pronto pra baixar em DOCX.
          {exemplo.artigo ? (
            <>
              {" "}
              Quer entender as palavras-chave da área?{" "}
              <Link
                href={`/artigos/${exemplo.artigo}`}
                className="font-semibold text-orange-700 underline-offset-4 hover:underline"
              >
                Leia o guia de currículo para {exemplo.area.toLowerCase()}
              </Link>
              .
            </>
          ) : null}
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-prep">
        <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-ink-3">
          Etapas 3–5 · Perguntas com roteiro
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink">
          3 das ~15 perguntas da preparação completa
        </h2>

        <div className="mt-5 space-y-4">
          {exemplo.perguntas.map((q) => (
            <article
              key={q.pergunta}
              className={`rounded-xl border-l-4 bg-bg p-4 ${PERGUNTA[q.cor].borda}`}
            >
              <p
                className={`text-xs font-bold uppercase tracking-wide ${PERGUNTA[q.cor].tipo}`}
              >
                {q.tipo}
              </p>
              <h3 className="mt-1 text-base font-bold text-ink">{q.pergunta}</h3>
              <p className="mt-2 text-sm leading-[1.7] text-ink-2">
                <strong>{q.rotulo}:</strong> {q.texto}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border-2 border-orange-500 bg-orange-soft/40 p-6 text-center shadow-prep sm:p-8">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">
          Agora imagine isso pra vaga que você quer
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-[1.6] text-ink-2">
          Cole o link da vaga + seu CV e comece pela análise ATS —{" "}
          <strong>grátis, sem cartão</strong>. A preparação completa (5 etapas,
          ~15 perguntas com roteiro e CV reescrito) custa R$10.
        </p>
        <div className="mt-5 flex justify-center">
          <Link
            href="/analise-ats-gratis"
            data-analytics-cta="exemplo_primary"
            data-analytics-location={exemplo.slug ? `exemplo/${exemplo.slug}` : "exemplo"}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(234,88,12,0.45)] transition hover:bg-brand-700"
          >
            Analisar meu currículo grátis
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
