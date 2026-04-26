export function Founder() {
  return (
    <section className="border-t border-neutral-200 bg-bg py-20 md:py-24 dark:border-zinc-800">
      <div className="mx-auto max-w-3xl px-6">
        <div className="rounded-2xl border border-neutral-200 bg-bg p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-10 dark:border-zinc-800">
          <div className="flex items-start gap-5">
            <div
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-600 dark:bg-brand-900/30"
            >
              RC
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Sobre o fundador
              </p>
              <blockquote className="mt-3 text-lg leading-[1.55] text-text-primary md:text-xl">
                15 anos em compras corporativas — analista a diretor em Bayer e Monsanto.
                Entrevistei centenas, fui entrevistado muitas. PrepaVAGA é o coach que eu queria
                ter tido em cada transição: de pleno pra sênior, de sênior pra gestão.
              </blockquote>
              <p className="mt-5 text-sm font-medium text-text-secondary">
                Rodrigo Costa <span className="text-text-tertiary">· Fundador</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
