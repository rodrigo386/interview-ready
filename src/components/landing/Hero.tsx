import Link from "next/link";
import { HeroMockup } from "./HeroMockup";

const CHIPS = ["1ª prep grátis", "R$10 por uso", "R$30/mês ilimitado"];

export function Hero() {
  return (
    <section className="border-b border-neutral-200 bg-bg pt-16 pb-8 md:pt-24 md:pb-12 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-bg px-3 py-1 text-xs font-medium text-text-secondary dark:border-zinc-800">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600" />
            Coach de carreira com IA
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-text-primary leading-[1.05] sm:text-5xl md:text-6xl">
            Entre pronto. Saia contratado.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-[1.6] text-text-secondary md:text-lg">
            Em 20 minutos, você recebe o dossiê completo da sua próxima vaga: empresa pesquisada,
            CV reescrito para ATS e roteiros prontos pra cada pergunta.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {CHIPS.map((c) => (
              <span
                key={c}
                className="rounded-full border border-neutral-200 bg-bg px-3 py-1 text-xs font-medium text-text-secondary dark:border-zinc-800"
              >
                {c}
              </span>
            ))}
          </div>

          <div className="mt-9 flex justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              Preparar minha próxima vaga
              <span aria-hidden>→</span>
            </Link>
          </div>
          <p className="mt-3 text-xs text-text-tertiary">
            Sem cartão. Sua primeira prep é grátis.
          </p>
        </div>

        <HeroMockup />
      </div>
    </section>
  );
}
