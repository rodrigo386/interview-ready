import Link from "next/link";

/**
 * O gancho é ver que existe mais coisa. Nunca renderizar o texto real dos
 * ajustes escondidos — nem borrado por CSS, que continua no HTML.
 */
export function LockedFix({ remaining }: { remaining: number }) {
  if (remaining <= 0) return null;
  const plural = remaining === 1 ? "ajuste" : "ajustes";

  return (
    <div className="rounded-lg border-2 border-dashed border-line bg-white p-5 text-center">
      <p className="text-sm font-bold text-ink">
        🔒 Mais {remaining} {plural} esperando
      </p>
      <p className="mt-1 text-sm text-ink-2">
        Crie sua conta grátis pra ver todos os ajustes e o currículo reescrito.
        Sua análise já fica salva — você não precisa colar nada de novo.
      </p>
      <Link
        href="/signup"
        className="mt-4 inline-flex rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
      >
        Ver todos os ajustes grátis →
      </Link>
    </div>
  );
}
