import Link from "next/link";

export function FinalCta() {
  return (
    <section className="border-t border-neutral-200 bg-bg py-20 md:py-24 dark:border-zinc-800">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Sua próxima entrevista não precisa ser por sorte.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-[1.6] text-text-secondary">
          Comece grátis. Sem cartão. A primeira prep sai em minutos.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Começar grátis
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
