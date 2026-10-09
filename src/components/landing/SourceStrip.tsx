/**
 * Faixa "de onde copiar a vaga", logo abaixo do vídeo.
 *
 * É a versão honesta da faixa de logos do concorrente. Lá os logos dizem "vagas
 * de" empresas; aqui o que é verdadeiro por construção é que a ferramenta
 * aceita TEXTO colado, então funciona com a vaga de qualquer site. Por isso a
 * frase manda copiar e colar, e não promete "cole o link".
 *
 * Por que a ferramenta anônima só aceita texto: a busca por link
 * (`fetchJdFromUrl`) exige login, e quando testamos o Jina Reader contra vagas
 * reais ele foi irregular (Catho e Vagas.com ok; Gupy trouxe a vaga completa em
 * 4 de 6; um link do LinkedIn redirecionou pra uma página de lista). Prometer
 * "funciona com o link da Gupy" no hero seria falso.
 *
 * Nomes em texto, não logos: usar a arte das marcas sugere parceria que não
 * existe. O aviso embaixo diz isso.
 */
const FONTES = ["LinkedIn", "Gupy", "Catho", "Vagas.com", "InfoJobs", "Indeed"] as const;

export function SourceStrip() {
  return (
    <section
      aria-label="De onde copiar a vaga"
      className="border-y border-neutral-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-6 text-center sm:px-6">
        <p className="text-sm font-medium text-text-secondary">
          Achou a vaga em qualquer um destes? Copie o texto e cole na análise
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          {FONTES.map((nome) => (
            <li
              key={nome}
              className="text-lg font-semibold tracking-tight text-neutral-400 dark:text-zinc-500"
            >
              {nome}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-ink-3">
          Nomes citados só para indicar de onde copiar a vaga, sem parceria ou vínculo
          com as marcas.
        </p>
      </div>
    </section>
  );
}
