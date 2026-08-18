import { DOSSIE_INCLUI, precoCurto } from "@/lib/billing/dossie";

/**
 * A ponte entre o produto grátis e o pago.
 *
 * A landing anterior não tinha essa seção: falava da análise ATS no hero e só
 * voltava a mencionar dinheiro sete seções depois, na tabela de preços. Quem
 * acabou de rodar o score precisa saber, ali mesmo, o que o crédito destrava —
 * essa é a única transação da página.
 *
 * Duas colunas assimétricas (grátis menor, pago maior) em vez de dois cards
 * iguais: a hierarquia visual já diz qual é a oferta.
 */
const GRATIS = [
  "Score ATS de 0 a 100 do seu CV contra essa vaga",
  "O ajuste que mais está te barrando, explicado",
  "Sem cadastro, sem cartão, quantas vagas quiser",
];

export function AfterScore() {
  return (
    <section
      id="depois-do-score"
      className="border-t border-neutral-200 bg-bg py-16 scroll-mt-20 md:py-20 dark:border-zinc-800"
    >
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          O score é grátis. O que você faz com ele custa {precoCurto()}.
        </h2>

        {/* items-start: sem isso os dois cards esticam para a mesma altura e o
            da esquerda, que tem menos itens, fica com um vazio no rodapé. */}
        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-8">
          <div className="rounded-xl border border-neutral-200 bg-bg p-6 dark:border-zinc-800">
            <p className="text-sm font-semibold text-text-tertiary">
              Agora, sem pagar nada
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">
              Análise ATS
            </p>
            <ul className="mt-5 space-y-3">
              {GRATIS.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-text-secondary">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-tertiary" />
                  <span className="leading-[1.55]">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border-2 border-orange-500 bg-orange-soft/40 p-6 dark:bg-orange-soft/10">
            <p className="text-sm font-semibold text-orange-700">
              Quando quiser a preparação inteira
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-2xl font-semibold text-text-primary">
                Dossiê completo
              </p>
              <p className="text-2xl font-bold text-orange-700">{precoCurto()}</p>
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {DOSSIE_INCLUI.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-text-primary">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white"
                  >
                    ✓
                  </span>
                  <span className="leading-[1.55]">{item}</span>
                </li>
              ))}
            </ul>
            {/* A garantia de 7 dias estava só na sétima pergunta do FAQ.
                Reversão de risco funciona ao lado do preço, não escondida. */}
            <p className="mt-6 text-sm text-text-secondary">
              Pagamento avulso. Sem assinatura, sem renovação automática, e o
              crédito não expira. Se não servir, você tem 7 dias para pedir o
              dinheiro de volta.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
