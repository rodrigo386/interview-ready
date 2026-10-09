/**
 * Faixa "de onde copiar a vaga", logo abaixo do vídeo — a versão honesta da faixa
 * de logos de um concorrente. Lá os logos dizem "vagas de" empresas; aqui dizem
 * de ONDE a pessoa pode trazer a vaga, e isso é verdade por dois caminhos: o
 * texto colado funciona com qualquer site, e o link funciona com a maioria
 * (busca por link: `analise-ats-gratis/jd-actions`).
 *
 * "A maioria" é medido, não promessa: Catho e Vagas.com ok, Gupy trouxe a vaga
 * completa em 4 de 6, LinkedIn costuma redirecionar pra uma página de lista. O
 * formulário avisa isso ao lado do campo de link e o `jd_link_fetch` registra
 * por domínio onde falha.
 *
 * Logos como SILHUETA cinza (CSS), a pedido: o `brightness-0` zera as cores
 * pra a faixa não parecer propaganda das marcas, e `dark:invert` mantém a
 * legibilidade no tema escuro. Isso ALTERA a cor dos logos, o que as diretrizes
 * de algumas marcas (LinkedIn, por exemplo) desaconselham: é uma decisão de
 * produto consciente, e o aviso embaixo diz que não há parceria.
 *
 * Só há arquivo vetorial de 4 das 6 marcas (Catho e InfoJobs, do próprio site
 * delas; Indeed e LinkedIn, da Wikimedia Commons). Gupy e Vagas.com ficam em
 * texto até alguém colocar o SVG oficial em `public/logos/` e preencher `logo`
 * abaixo — o fallback em texto já está no mesmo cinza.
 */
type Fonte = {
  nome: string;
  /** Dimensões intrínsecas do arquivo (evitam salto de layout), e a altura em px. */
  logo?: { src: string; w: number; h: number; altura: number };
};

const FONTES: readonly Fonte[] = [
  { nome: "LinkedIn", logo: { src: "/logos/linkedin.svg", w: 267.5, h: 65.3, altura: 26 } },
  { nome: "Gupy" },
  { nome: "Catho", logo: { src: "/logos/catho.svg", w: 520, h: 83, altura: 22 } },
  { nome: "Vagas.com" },
  { nome: "InfoJobs", logo: { src: "/logos/infojobs.svg", w: 322, h: 125, altura: 32 } },
  { nome: "Indeed", logo: { src: "/logos/indeed.svg", w: 1486.1, h: 400, altura: 26 } },
];

export function SourceStrip() {
  return (
    <section
      aria-label="De onde copiar a vaga"
      className="border-y border-neutral-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-7 text-center sm:px-6">
        <p className="text-sm font-medium text-text-secondary">
          Achou a vaga em um destes ou no site da empresa? Cole o link, ou copie o
          texto e cole na análise
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {FONTES.map(({ nome, logo }) => (
            <li key={nome} className="flex items-center">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeno: next/image não ganha nada aqui
                <img
                  src={logo.src}
                  alt={nome}
                  width={logo.w}
                  height={logo.h}
                  loading="lazy"
                  decoding="async"
                  style={{ height: logo.altura, width: "auto" }}
                  className="opacity-40 brightness-0 dark:opacity-50 dark:invert"
                />
              ) : (
                <span className="text-lg font-semibold tracking-tight text-neutral-400 dark:text-zinc-500">
                  {nome}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-ink-3">
          Nomes e logos citados só para indicar de onde trazer a vaga, sem parceria
          ou vínculo. Marcas de seus respectivos donos.
        </p>
      </div>
    </section>
  );
}
