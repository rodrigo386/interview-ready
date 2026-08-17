import Link from "next/link";

/**
 * O gancho é ver que existe mais coisa. Nunca renderizar o texto real dos
 * ajustes escondidos — nem borrado por CSS, que continua no HTML.
 *
 * `remaining` = total de top_fixes menos o primeiro (mostrado por inteiro na
 * página anônima). Mas a tela logada (`AtsFixesSection`) mostra só
 * `fixes.slice(0, 3)` — os TRÊS PRIMEIROS, o que inclui o que a pessoa já viu
 * grátis. Então o cadastro revela no máximo 2 ajustes NOVOS
 * (`min(remaining, 2)`), nunca `remaining` inteiro. Anunciar `remaining` seria
 * prometer, por exemplo, "mais 6" quando só 2 aparecem depois do cadastro.
 */
export function LockedFix({ remaining }: { remaining: number }) {
  if (remaining <= 0) return null;
  const revealed = Math.min(remaining, 2);
  const plural = revealed === 1 ? "ajuste" : "ajustes";

  return (
    <div className="rounded-lg border-2 border-dashed border-line bg-white p-5 text-center">
      <p className="text-sm font-bold text-ink">
        🔒 Mais {revealed} {plural} esperando
      </p>
      <p className="mt-1 text-sm text-ink-2">
        Crie sua conta grátis pra ver mais {revealed} {plural} da sua análise
        ATS. Sua análise já fica salva — você não precisa colar nada de novo.
      </p>
      <Link
        href="/signup"
        className="mt-4 inline-flex rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
      >
        Ver mais {revealed} {plural}, sem pagar →
      </Link>
    </div>
  );
}
