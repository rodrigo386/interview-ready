"use client";

import { useEffect, useRef, useState } from "react";
import { Gauge } from "@/components/prep/Gauge";
import {
  BlocoAts,
  BlocoPerguntas,
  BlocoVaga,
  NIVEL,
} from "@/components/exemplo/ExemploBlocos";
import { EXEMPLO_PRINCIPAL, EXEMPLOS, type Exemplo } from "@/lib/exemplos/data";

const AREAS: Exemplo[] = [EXEMPLO_PRINCIPAL, ...EXEMPLOS];

const ABAS = [
  { id: "score", rotulo: "Score" },
  { id: "ajustes", rotulo: "Ajustes" },
  { id: "empresa", rotulo: "Empresa e salário" },
  { id: "perguntas", rotulo: "Perguntas" },
] as const;
type AbaId = (typeof ABAS)[number]["id"];

/**
 * Demonstração interativa do resultado, para a pessoa ver o que recebe ANTES de
 * usar a ferramenta — o mesmo papel que o mockup do "autopilot" tem no
 * concorrente que serviu de referência, mas com a nossa interface real.
 *
 * Reaproveita os blocos da página /exemplo (`ExemploBlocos`) e o `Gauge`, com
 * os mesmos dados fictícios (lib/exemplos/data.ts): nada aqui é um mockup
 * desenhado à parte que possa divergir do produto.
 *
 * O Gauge só monta depois que a seção entra na tela. Ele anima ao montar (ver
 * globals.css, "Motion do score"); montado fora da tela a animação já teria
 * acabado quando a pessoa chegasse. Trocar de área ou voltar à aba Score
 * remonta o medidor (por `key`) e a animação toca de novo.
 */
export function LandingDemo() {
  const [area, setArea] = useState(0);
  const [aba, setAba] = useState<AbaId>("score");
  const [visto, setVisto] = useState(false);
  const raiz = useRef<HTMLElement>(null);
  const abasRef = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisto(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisto(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const e = AREAS[area];

  function teclado(ev: React.KeyboardEvent, i: number) {
    let prox = i;
    if (ev.key === "ArrowRight") prox = (i + 1) % ABAS.length;
    else if (ev.key === "ArrowLeft") prox = (i - 1 + ABAS.length) % ABAS.length;
    else if (ev.key === "Home") prox = 0;
    else if (ev.key === "End") prox = ABAS.length - 1;
    else return;
    ev.preventDefault();
    setAba(ABAS[prox].id);
    abasRef.current[ABAS[prox].id]?.focus();
  }

  const contagem = (["Crítico", "Alto", "Médio"] as const).map((n) => ({
    nivel: n,
    n: e.ats.filter((i) => i.nivel === n).length,
  }));

  return (
    <section
      ref={raiz}
      id="demo"
      aria-label="Demonstração do resultado"
      className="border-t border-neutral-200 bg-bg py-16 scroll-mt-20 md:py-20 dark:border-zinc-800"
    >
      <div className="mx-auto max-w-4xl px-5 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Veja o que você recebe
        </h2>

        <div role="group" aria-label="Escolha a área do exemplo" className="mt-6 flex flex-wrap gap-2">
          {AREAS.map((a, i) => (
            <button
              key={a.slug || "marketing"}
              type="button"
              aria-pressed={i === area}
              data-analytics-cta={`demo_area_${a.slug || "marketing"}`}
              data-analytics-location="landing"
              onClick={() => setArea(i)}
              className={
                i === area
                  ? "rounded-pill bg-ink px-4 py-1.5 text-sm font-semibold text-white"
                  : "rounded-pill border border-line bg-white px-4 py-1.5 text-sm font-medium text-ink-2 transition hover:border-ink-3 hover:text-ink"
              }
            >
              {a.area}
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white shadow-prep">
          <div
            role="tablist"
            aria-label="Partes do resultado"
            className="flex gap-1 overflow-x-auto border-b border-line bg-bg p-2"
          >
            {ABAS.map((a, i) => (
              <button
                key={a.id}
                ref={(el) => {
                  abasRef.current[a.id] = el;
                }}
                id={`demo-aba-${a.id}`}
                role="tab"
                type="button"
                aria-selected={aba === a.id}
                aria-controls="demo-painel"
                tabIndex={aba === a.id ? 0 : -1}
                data-analytics-cta={`demo_aba_${a.id}`}
                data-analytics-location="landing"
                onClick={() => setAba(a.id)}
                onKeyDown={(ev) => teclado(ev, i)}
                className={
                  aba === a.id
                    ? "shrink-0 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white sm:px-4"
                    : "shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition hover:bg-white hover:text-ink sm:px-4"
                }
              >
                {a.rotulo}
              </button>
            ))}
          </div>

          <div
            id="demo-painel"
            role="tabpanel"
            aria-labelledby={`demo-aba-${aba}`}
            tabIndex={0}
            className="min-h-[24rem] p-5 sm:p-7"
          >
            {aba === "score" && (
              <div className="flex flex-col items-center gap-8 py-4 sm:flex-row sm:justify-center sm:gap-12">
                {visto ? (
                  <Gauge key={`${e.slug}-score`} value={e.score} />
                ) : (
                  <div className="h-[200px] w-[200px]" aria-hidden />
                )}
                <div className="max-w-xs text-center sm:text-left">
                  <p className="text-sm font-semibold uppercase tracking-wide text-ink-3">
                    {e.cargo}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-ink">
                    {e.ats.length} {e.ats.length === 1 ? "ajuste encontrado" : "ajustes encontrados"}
                  </p>
                  <ul className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                    {contagem
                      .filter((c) => c.n > 0)
                      .map((c) => (
                        <li
                          key={c.nivel}
                          className={`rounded-pill px-3 py-1 text-xs font-bold uppercase tracking-wide ${NIVEL[c.nivel].card} ${NIVEL[c.nivel].rotulo}`}
                        >
                          {c.n} {c.nivel}
                        </li>
                      ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setAba("ajustes")}
                    data-analytics-cta="demo_ver_ajustes"
                    data-analytics-location="landing"
                    className="mt-5 text-sm font-semibold text-orange-700 underline-offset-4 hover:underline"
                  >
                    Ver os ajustes →
                  </button>
                </div>
              </div>
            )}
            {aba === "ajustes" && <BlocoAts exemplo={e} mostrarArtigo={false} />}
            {aba === "empresa" && <BlocoVaga exemplo={e} />}
            {aba === "perguntas" && <BlocoPerguntas exemplo={e} />}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-xs text-ink-3">
            Vaga, empresa, números e faixa salarial deste exemplo são ilustrativos.
          </p>
          <a
            href="#analisar"
            data-analytics-cta="landing_demo_cta"
            data-analytics-location="landing"
            className="inline-flex items-center gap-2 rounded-pill bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Fazer a minha análise grátis
            <span aria-hidden>↑</span>
          </a>
        </div>
      </div>
    </section>
  );
}
