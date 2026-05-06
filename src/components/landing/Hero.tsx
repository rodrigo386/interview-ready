import Link from "next/link";
import { HeroMockup } from "./HeroMockup";

const HEADLINE = "Entre pronto. Saia contratado.";
const CHIPS = ["1ª prep grátis", "R$30/mês ilimitado"];

const CHAR_STAGGER_MS = 32;
const HEADLINE_TOTAL_MS = HEADLINE.length * CHAR_STAGGER_MS;
const SUB_DELAY_MS = HEADLINE_TOTAL_MS + 100;
const CHIPS_DELAY_MS = SUB_DELAY_MS + 200;
const CTA_DELAY_MS = CHIPS_DELAY_MS + 200;
const MOCKUP_DELAY_MS = CTA_DELAY_MS + 250;

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-neutral-200 bg-bg dark:border-zinc-800">
      <BackdropPattern />
      <FlyingCvs />

      <div className="relative mx-auto max-w-6xl px-5 pt-20 pb-10 sm:px-6 md:pt-32 md:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-serif font-normal tracking-tight text-text-primary leading-[1.02] text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl">
            {HEADLINE.split("").map((char, i) => (
              <span
                key={i}
                className="motion-safe:opacity-0 motion-safe:animate-[heroCharIn_320ms_ease-out_forwards]"
                style={{ animationDelay: `${i * CHAR_STAGGER_MS}ms` }}
              >
                {char}
              </span>
            ))}
          </h1>

          <div
            className="mx-auto mt-7 max-w-xl text-base leading-[1.6] text-text-secondary md:text-lg motion-safe:opacity-0 motion-safe:animate-[heroFadeUp_700ms_ease-out_forwards]"
            style={{ animationDelay: `${SUB_DELAY_MS}ms` }}
          >
            <p>
              Cole o link da vaga e seu CV. Em minutos, você recebe um dossiê personalizado:
              empresa pesquisada em tempo real, CV reescrito pra ATS e roteiros prontos pra cada
              pergunta da entrevista.
            </p>
          </div>

          <div
            className="mt-7 flex flex-wrap items-center justify-center gap-2 motion-safe:opacity-0 motion-safe:animate-[heroFadeUp_700ms_ease-out_forwards]"
            style={{ animationDelay: `${CHIPS_DELAY_MS}ms` }}
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
            className="mt-9 flex flex-col items-center justify-center gap-3 motion-safe:opacity-0 motion-safe:animate-[heroFadeUp_700ms_ease-out_forwards]"
            style={{ animationDelay: `${CTA_DELAY_MS}ms` }}
          >
            <Link
              href="/signup"
              className="inline-flex max-w-full items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(234,88,12,0.45)] transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:px-7 sm:py-3.5 sm:text-base"
            >
              <span className="truncate">Quero entrar na entrevista preparado</span>
              <span aria-hidden>→</span>
            </Link>
            <p className="text-xs text-text-tertiary">Sem cartão. Primeira prep grátis.</p>
          </div>
        </div>

        <div
          className="motion-safe:opacity-0 motion-safe:animate-[heroFadeUp_900ms_ease-out_forwards]"
          style={{ animationDelay: `${MOCKUP_DELAY_MS}ms` }}
        >
          <HeroMockup />
        </div>
      </div>

      <style>{`
        @keyframes heroCharIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
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

type CvSpec = {
  pos: string;
  rotate: string;
  accent: "brand" | "neutral";
  size: "sm" | "md" | "lg";
  float: "A" | "B" | "C" | "D" | "E";
  duration: string;
  delay: string;
  enter: string;
};

const CVS: CvSpec[] = [
  { pos: "left-[3%] top-[18%]", rotate: "-rotate-[14deg]", accent: "brand", size: "sm", float: "A", duration: "8s", delay: "-2s", enter: "0.1s" },
  { pos: "left-[8%] top-[44%]", rotate: "-rotate-[8deg]", accent: "brand", size: "md", float: "B", duration: "7s", delay: "-1s", enter: "0.25s" },
  { pos: "left-[13%] top-[70%]", rotate: "rotate-[6deg]", accent: "neutral", size: "sm", float: "C", duration: "9s", delay: "-3s", enter: "0.4s" },
  { pos: "right-[4%] top-[14%]", rotate: "rotate-[12deg]", accent: "neutral", size: "sm", float: "D", duration: "8.5s", delay: "-1.5s", enter: "0.55s" },
  { pos: "right-[8%] top-[34%]", rotate: "rotate-[7deg]", accent: "brand", size: "md", float: "E", duration: "7.5s", delay: "0s", enter: "0.35s" },
  { pos: "right-[3%] top-[58%]", rotate: "-rotate-[5deg]", accent: "brand", size: "lg", float: "A", duration: "10s", delay: "-4s", enter: "0.6s" },
  { pos: "right-[16%] top-[78%]", rotate: "rotate-[3deg]", accent: "neutral", size: "sm", float: "C", duration: "9.5s", delay: "-2.5s", enter: "0.75s" },
  { pos: "left-[18%] top-[10%]", rotate: "rotate-[18deg]", accent: "neutral", size: "sm", float: "D", duration: "11s", delay: "-3.5s", enter: "0.85s" },
];

function FlyingCvs() {
  return (
    <>
      {CVS.map((cv, i) => (
        <MiniCv key={i} spec={cv} />
      ))}
      <style>{`
        @keyframes cvIn {
          0% { transform: translateY(28px) scale(0.9); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes cvFloatA {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(6px, -16px); }
        }
        @keyframes cvFloatB {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-8px, -14px); }
        }
        @keyframes cvFloatC {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(10px, -10px); }
          66% { transform: translate(-4px, -18px); }
        }
        @keyframes cvFloatD {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-12px, -22px); }
        }
        @keyframes cvFloatE {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-6px, -8px); }
          75% { transform: translate(8px, -16px); }
        }
      `}</style>
    </>
  );
}

function MiniCv({ spec }: { spec: CvSpec }) {
  const dims =
    spec.size === "sm"
      ? "w-12 h-[3.75rem]"
      : spec.size === "lg"
        ? "w-[4.5rem] h-[6rem]"
        : "w-16 h-[5.25rem]";
  const avatarBg = spec.accent === "brand" ? "bg-brand-600" : "bg-neutral-300";
  return (
    <div
      aria-hidden
      className={
        "pointer-events-none absolute hidden rounded-md border border-neutral-200 bg-white p-1.5 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.18)] motion-safe:opacity-0 motion-safe:animate-[cvIn_1s_ease-out_both] dark:border-zinc-700 dark:bg-zinc-900 md:block " +
        dims +
        " " +
        spec.rotate +
        " " +
        spec.pos
      }
      style={{
        animationDelay: spec.enter,
      }}
    >
      <div
        className="h-full motion-safe:animate-[cvFloat_7s_ease-in-out_infinite]"
        style={{
          animationName: `cvFloat${spec.float}`,
          animationDuration: spec.duration,
          animationDelay: spec.delay,
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
        }}
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
    </div>
  );
}
