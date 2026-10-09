import Link from "next/link";

/**
 * Linha de confiança junto do formulário.
 *
 * O concorrente gasta 4 das 8 respostas da FAQ em "o que acontece com o meu
 * currículo / o que é enviado a quem". Quem cola um currículo numa ferramenta
 * anônima tem exatamente essa dúvida, e a resposta estava em letra pequena
 * (a política de privacidade) ou nem estava. Cada afirmação aqui sai de
 * /privacidade ou do próprio formulário — mudou lá, mude aqui:
 *  - 7 dias: o texto extraído da análise anônima expira em 7 dias.
 *  - "não vendemos" / "não treinamos IA com seus dados": seção 3 e 4 da política.
 *  - IA do Google, servidores nos EUA: seção 4 (processadores).
 *  - 7 dias de reembolso, sem assinatura: FAQ e DossiePitch.
 * Dizer QUEM processa o currículo (o Google) é parte da confiança, não um
 * detalhe a esconder.
 */
const ITENS = [
  {
    icone: "relogio",
    texto: "Análise grátis: guardamos só o texto extraído, por 7 dias",
  },
  {
    icone: "escudo",
    texto: "Não vendemos seus dados nem treinamos IA com eles",
  },
  {
    icone: "servidor",
    texto: "A análise usa a IA do Google, em servidores nos Estados Unidos",
  },
  {
    icone: "volta",
    texto: "Preparação completa sem assinatura e com 7 dias para pedir reembolso",
  },
] as const;

export function TrustRow() {
  return (
    <div className="mt-10">
      <ul
        aria-label="Como tratamos o seu currículo"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {ITENS.map((it) => (
          <li key={it.icone} className="flex items-start gap-3 text-[13px] leading-[1.45] text-text-secondary">
            <span aria-hidden className="mt-0.5 shrink-0 text-orange-700">
              <Icone nome={it.icone} />
            </span>
            <span>{it.texto}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-3">
        <Link href="/privacidade" className="font-semibold underline-offset-4 hover:underline">
          Política de privacidade
        </Link>
        {" · "}
        <Link href="/lgpd" className="font-semibold underline-offset-4 hover:underline">
          Seus direitos na LGPD
        </Link>
      </p>
    </div>
  );
}

function Icone({ nome }: { nome: (typeof ITENS)[number]["icone"] }) {
  const base = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (nome) {
    case "relogio":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "escudo":
      return (
        <svg {...base}>
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "servidor":
      return (
        <svg {...base}>
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
          <path d="M7 7h.01M7 17h.01" />
        </svg>
      );
    case "volta":
      return (
        <svg {...base}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      );
  }
}
