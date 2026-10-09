/**
 * Anotação manuscrita com seta, para apontar um elemento da página. Toque de
 * personalidade tirado do hero de um concorrente ("real interviews our users
 * get" com uma seta). Decorativa: `aria-hidden`, porque o que ela diz o vídeo
 * já diz e leitor de tela não precisa de duas vezes.
 *
 * A fonte (`--font-hand`, Caveat) é declarada no layout com `preload: false`.
 * Nada de ponto final: segue a regra de texto na tela dos vídeos.
 */
export function HandNote({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none select-none ${className}`}
    >
      <p
        className="-rotate-3 text-[1.7rem] leading-none text-orange-700"
        style={{ fontFamily: "var(--font-hand), cursive" }}
      >
        {children}
      </p>
      <svg
        width="64"
        height="44"
        viewBox="0 0 64 44"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-10 mt-0.5 text-orange-700"
      >
        <path d="M4 4c18 2 34 10 44 30" />
        <path d="M38 30l10 5 3-11" />
      </svg>
    </div>
  );
}
