"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeroMockup } from "./HeroMockup";

const HEADLINE = "Entre pronto. Saia contratado.";
const CHIPS = ["1ª prep grátis", "R$10 por uso", "R$30/mês ilimitado"];

export function Hero() {
  const typed = useTypewriter(HEADLINE, 38);
  const done = typed.length === HEADLINE.length;

  return (
    <section className="relative overflow-hidden border-b border-zinc-800 bg-[#0F1014] text-zinc-100">
      <BackdropPattern />
      <CursorDecor />

      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/40 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />
            Coach de carreira com IA
          </span>

          <h1
            className="mt-7 font-serif font-normal tracking-tight text-zinc-50 leading-[1.02] text-5xl sm:text-6xl md:text-7xl"
            aria-label={HEADLINE}
          >
            <span aria-hidden>{typed}</span>
            <span
              aria-hidden
              className={
                "ml-0.5 inline-block w-[0.06em] -translate-y-[0.05em] bg-brand-500 align-middle " +
                (done ? "h-[0.85em] motion-safe:animate-[caretBlink_1s_steps(2,start)_infinite]" : "h-[0.85em]")
              }
              style={{ verticalAlign: "-0.05em" }}
            />
          </h1>

          <div
            className={
              "mx-auto mt-7 max-w-xl text-base leading-[1.6] text-zinc-300/90 md:text-lg motion-safe:transition-all motion-safe:duration-700 " +
              (done ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
            }
          >
            <p>
              Cole o link da vaga e seu CV. Em 20 minutos, você recebe um dossiê personalizado:
              empresa pesquisada em tempo real, CV reescrito pra ATS, e roteiros prontos pra cada
              pergunta da entrevista.
            </p>
          </div>

          <div
            className={
              "mt-7 flex flex-wrap items-center justify-center gap-2 motion-safe:transition-all motion-safe:duration-700 motion-safe:delay-150 " +
              (done ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
            }
          >
            {CHIPS.map((c) => (
              <span
                key={c}
                className="rounded-full border border-zinc-700/80 bg-zinc-900/40 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur"
              >
                {c}
              </span>
            ))}
          </div>

          <div
            className={
              "mt-9 flex flex-col items-center justify-center gap-3 motion-safe:transition-all motion-safe:duration-700 motion-safe:delay-300 " +
              (done ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
            }
          >
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(234,88,12,0.6)] transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1014]"
            >
              Preparar minha próxima vaga
              <span aria-hidden>→</span>
            </Link>
            <p className="text-xs text-zinc-500">Sem cartão. Primeira prep grátis.</p>
          </div>
        </div>

        <div
          className={
            "motion-safe:transition-all motion-safe:duration-1000 motion-safe:delay-500 " +
            (done ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")
          }
        >
          <HeroMockup />
        </div>
      </div>

      <style>{`
        @keyframes caretBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </section>
  );
}

function useTypewriter(text: string, speedMs: number): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= text.length) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setI(text.length);
      return;
    }
    const t = setTimeout(() => setI((v) => v + 1), speedMs);
    return () => clearTimeout(t);
  }, [i, text, speedMs]);
  return text.slice(0, i);
}

function BackdropPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.18]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }}
    />
  );
}

function CursorDecor() {
  return (
    <>
      <svg
        aria-hidden
        className="pointer-events-none absolute left-[6%] top-[42%] hidden h-10 w-10 text-zinc-50 motion-safe:animate-[cursorLeft_1.2s_ease-out_0.2s_both] md:block"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M5 3.5 L5 18 L9.5 14 L12.5 20.5 L15 19.5 L12 13 L18 13 Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          fill="rgba(15,16,20,0.35)"
        />
      </svg>
      <svg
        aria-hidden
        className="pointer-events-none absolute right-[7%] top-[26%] hidden h-9 w-9 motion-safe:animate-[cursorRight_1.2s_ease-out_0.4s_both] md:block"
        viewBox="0 0 24 24"
      >
        <path
          d="M5 3.5 L5 18 L9.5 14 L12.5 20.5 L15 19.5 L12 13 L18 13 Z"
          fill="#EA580C"
          stroke="#FFB87A"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      </svg>
      <style>{`
        @keyframes cursorLeft {
          0% { transform: translate(-32px, 32px); opacity: 0; }
          100% { transform: translate(0, 0); opacity: 1; }
        }
        @keyframes cursorRight {
          0% { transform: translate(32px, 32px); opacity: 0; }
          100% { transform: translate(0, 0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
