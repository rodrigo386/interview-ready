export function Founder() {
  return (
    <section className="bg-surface py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 md:grid-cols-[auto_1fr]">
        <div
          className="mx-auto h-40 w-40 shrink-0 overflow-hidden rounded-full border-4 border-brand-100 bg-surface-muted"
          aria-hidden
        >
          {/* Placeholder até /public/brand/rodrigo.jpg existir */}
          <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-text-tertiary">
            RC
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            Sobre o fundador
          </p>
          <blockquote className="mt-4 text-lg text-text-primary leading-relaxed md:text-xl">
            Sou Rodrigo, fundador do PrepaVaga. Passei 15 anos em compras
            corporativas — subi de analista a diretor em multinacionais como
            Bayer e Monsanto. Entrevistei centenas de pessoas e fui
            entrevistado muitas. Sei o que um gestor brasileiro procura no
            candidato que promove. O PrepaVaga é o coach que eu gostaria de
            ter tido quando troquei de pleno para sênior, e de sênior para
            gerente.
          </blockquote>
          <p className="mt-6 text-sm font-medium text-text-secondary">
            Rodrigo Costa — Fundador
          </p>
        </div>
      </div>
    </section>
  );
}
