import Link from "next/link";

/**
 * Aviso de que a nota ATS está calculada sobre pouco texto de vaga. Sem ele a
 * pessoa lê "RISCO ALTO DE REJEIÇÃO" como um veredito sobre o currículo, quando
 * o problema é que a régua tinha uma ou duas palavras.
 */
export function ShortJdNotice({ words }: { words: number }) {
  return (
    <div
      role="note"
      className="rounded-lg border-l-4 border-yellow-500 bg-yellow-soft px-5 py-4 text-[15px] text-ink"
    >
      <p className="font-semibold">
        A descrição da vaga tem só {words} {words === 1 ? "palavra" : "palavras"}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-ink-2">
        A nota compara seu currículo com as palavras que a vaga pede. Com tão
        pouco texto, ela não é confiável e pode ficar bem abaixo do que seria
        com a vaga completa. Para uma nota que valha, cole o anúncio inteiro
        (responsabilidades e requisitos) em uma{" "}
        <Link href="/prep/new" className="font-semibold underline">
          nova análise
        </Link>
        .
      </p>
    </div>
  );
}
