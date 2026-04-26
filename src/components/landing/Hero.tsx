"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeroMockup } from "./HeroMockup";

const HEADLINE = "Entre pronto. Saia contratado.";
const CHIPS = ["1ª prep grátis", "R$30/mês ilimitado"];

export function Hero() {
  const typed = useTypewriter(HEADLINE, 38);
  const done = typed.length === HEADLINE.length;

  return (
    <section className="relative overflow-hidden border-b border-neutral-200 bg-bg dark:border-zinc-800">
      <BackdropPattern />
      <FlyingCvs />

      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1
            className="font-serif font-normal tracking-tight text-text-primary leading-[1.02] text-5xl sm:text-6xl md:text-7xl"
            aria-label={HEADLINE}
          >
            <span aria-hidden>{typed}</span>
            <span
              aria-hidden
              className={
                "ml-0.5 inline-block w-[0.06em] -translate-y-[0.05em] bg-brand-600 align-middle " +
                (done ? "h-[0.85em] motion-safe:animate-[caretBlink_1s_steps(2,start)_infinite]" : "h-[0.85em]")
              }
              style={{ verticalAlign: "-0.05em" }}
            />
          </h1>

          <div
            className={
              "mx-auto mt-7 max-w-xl text-base leading-[1.6] text-text-secondary md:text-lg motion-safe:transition-all motion-safe:duration-700 " +
              (done ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
            }
          >
            <p>
              Cole o link da vaga e seu CV. Em minutos, você recebe um dossiê personalizado:
              empresa pesquisada em tempo real, CV reescrito pra ATS e roteiros prontos pra cada
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
                className="rounded-full border border-neutral-200 bg-bg px-3 py-1 text-xs font-medium text-text-secondary dark:border-zinc-800"
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
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(234,88,12,0.45)] transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              Preparar minha próxima vaga
              <span aria-hidden>→</span>
            </Link>
            <p className="text-xs text-text-tertiary">Sem cartão. Primeira prep grátis.</p>
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
      className="pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-[0.12]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.45) 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }}
    />
  );
}

function FlyingCvs() {
  return (
    <>
      <MiniCv
        className="left-[5%] top-[44%] motion-safe:animate-[cvFloatLeft_7s_ease-in-out_infinite,cvIn_1s_ease-out_0.2s_both] md:block"
        rotate="-rotate-[10deg]"
        accent="brand"
      />
      <MiniCv
        className="right-[6%] top-[26%] motion-safe:animate-[cvFloatRight_8s_ease-in-out_infinite,cvIn_1s_ease-out_0.4s_both] md:block"
        rotate="rotate-[8deg]"
        accent="neutral"
      />
      <MiniCv
        className="right-[14%] top-[60%] motion-safe:animate-[cvFloatMid_9s_ease-in-out_infinite,cvIn_1s_ease-out_0.7s_both] md:block"
        rotate="rotate-[-4deg]"
        accent="brand"
        size="sm"
      />
      <style>{`
        @keyframes cvIn {
          0% { transform: translateY(24px) scale(0.92); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes cvFloatLeft {
          0%, 100% { transform: translateY(0) rotate(-10deg); }
          50% { transform: translateY(-14px) rotate(-7deg); }
        }
        @keyframes cvFloatRight {
          0%, 100% { transform: translateY(0) rotate(8deg); }
          50% { transform: translateY(-18px) rotate(11deg); }
        }
        @keyframes cvFloatMid {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-10px) rotate(-1deg); }
        }
      `}</style>
    </>
  );
}

function MiniCv({
  className,
  rotate,
  accent,
  size = "md",
}: {
  className: string;
  rotate: string;
  accent: "brand" | "neutral";
  size?: "sm" | "md";
}) {
  const dims = size === "sm" ? "w-14 h-[4.5rem]" : "w-16 h-[5.5rem]";
  const avatarBg = accent === "brand" ? "bg-brand-600" : "bg-neutral-300";
  return (
    <div
      aria-hidden
      className={
        "pointer-events-none absolute hidden rounded-md border border-neutral-200 bg-white p-1.5 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.18)] dark:border-zinc-700 dark:bg-zinc-900 " +
        dims +
        " " +
        rotate +
        " " +
        className
      }
    >
      <div className="flex items-center gap-1">
        <span className={`h-2.5 w-2.5 rounded-full ${avatarBg}`} />
        <div className="flex-1 space-y-0.5">
          <span className="block h-[3px] w-full rounded-full bg-neutral-300 dark:bg-zinc-700" />
          <span className="block h-[2px] w-3/4 rounded-full bg-neutral-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="mt-1.5 space-y-1">
        <span className="block h-[2px] w-full rounded-full bg-neutral-200 dark:bg-zinc-800" />
        <span className="block h-[2px] w-5/6 rounded-full bg-neutral-200 dark:bg-zinc-800" />
        <span className="block h-[2px] w-4/6 rounded-full bg-neutral-200 dark:bg-zinc-800" />
        <span className="block h-[2px] w-full rounded-full bg-neutral-200 dark:bg-zinc-800" />
        <span className="block h-[2px] w-3/5 rounded-full bg-neutral-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
