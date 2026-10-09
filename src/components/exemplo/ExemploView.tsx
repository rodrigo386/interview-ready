import Link from "next/link";
import { EXEMPLO_PRINCIPAL, EXEMPLOS, type Exemplo } from "@/lib/exemplos/data";
import { BlocoAts, BlocoPerguntas, BlocoVaga } from "./ExemploBlocos";

function hrefDo(e: Exemplo) {
  return e.slug ? `/exemplo/${e.slug}` : "/exemplo";
}

/**
 * Página "veja antes de criar conta". Serve ao /exemplo (marketing) e a cada
 * /exemplo/[slug]. Dados sempre fictícios — ver lib/exemplos/data.ts.
 */
export function ExemploView({ exemplo }: { exemplo: Exemplo }) {
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
        <BlocoVaga exemplo={exemplo} />
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-prep">
        <BlocoAts exemplo={exemplo} />
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-prep">
        <BlocoPerguntas exemplo={exemplo} />
      </section>

      <section className="mt-10 rounded-2xl border-2 border-orange-500 bg-orange-soft/40 p-6 text-center shadow-prep sm:p-8">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">
          Agora imagine isso pra vaga que você quer
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-[1.6] text-ink-2">
          Cole a vaga + seu CV e comece pela análise ATS —{" "}
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
