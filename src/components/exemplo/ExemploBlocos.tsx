import Link from "next/link";
import type { ReactNode } from "react";
import type { CorPergunta, Exemplo, Nivel } from "@/lib/exemplos/data";

/**
 * Blocos de apresentação de um exemplo de preparação, usados pela página
 * /exemplo (ExemploView) e pela demo interativa da landing (LandingDemo).
 * Apresentação pura, sem hooks: servem em componente de servidor e de cliente.
 * Dados SEMPRE fictícios — ver lib/exemplos/data.ts.
 */

/** Classes literais (não montadas por string) para o Tailwind enxergar todas. */
export const NIVEL: Record<Nivel, { card: string; rotulo: string }> = {
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

export function faixaDoScore(score: number) {
  if (score <= 40) return { fundo: "bg-red-soft", texto: "text-red-500" };
  if (score <= 70) return { fundo: "bg-yellow-soft", texto: "text-yellow-700" };
  return { fundo: "bg-green-soft", texto: "text-green-700" };
}

/** Converte **destaque** em <strong>, sem dangerouslySetInnerHTML. */
export function comDestaque(texto: string): ReactNode[] {
  return texto
    .split("**")
    .map((parte, i) => (i % 2 === 1 ? <strong key={i}>{parte}</strong> : parte));
}

/** A vaga, a pesquisa da empresa e a faixa salarial. */
export function BlocoVaga({ exemplo }: { exemplo: Exemplo }) {
  return (
    <>
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
    
    </>
  );
}

/** Score e os ajustes da análise ATS. `mostrarArtigo` liga o link pro guia da área. */
export function BlocoAts({
  exemplo,
  mostrarArtigo = true,
}: {
  exemplo: Exemplo;
  mostrarArtigo?: boolean;
}) {
  const faixa = faixaDoScore(exemplo.score);
  return (
    <>
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
        {exemplo.artigo && mostrarArtigo ? (
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
    
    </>
  );
}

/** As 3 perguntas com roteiro. */
export function BlocoPerguntas({ exemplo }: { exemplo: Exemplo }) {
  return (
    <>
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
    
    </>
  );
}
