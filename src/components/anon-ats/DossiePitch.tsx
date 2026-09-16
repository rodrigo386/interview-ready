import Link from "next/link";
import { precoCurto } from "@/lib/billing/dossie";
import { isCargoDesconhecido, isEmpresaDesconhecida } from "@/lib/anon-ats/core";

/**
 * O que os R$10 destravam, na página onde a pessoa acabou de ver o score.
 *
 * Nasceu de funil real (18/08): quem rodava a análise grátis criava conta e
 * parava no paywall sem saber o que comprava, porque a única explicação do
 * produto pago estava na home. O pitch precisa morar aqui, no ponto de maior
 * intenção.
 *
 * REVISÃO de 2026-09-16 — duas mudanças, ambas vindas de dado:
 *
 * 1. A oferta passa a LIDERAR COM O CURRÍCULO. Quem acabou de ver "seu score é
 *    34" tem uma dor imediata — "meu currículo não passa" — e a resposta mais
 *    direta pra ela é o CV reescrito, que já estava no pacote mas aparecia no
 *    meio de uma lista. Além disso, o benchmarking de 09/09 mostrou que Gupy e
 *    SENAI dão perguntas de entrevista de graça e ilimitadas, mas nenhum dos
 *    dois reescreve o currículo contra a vaga. Perguntas saem da vitrine;
 *    continuam no produto.
 *
 * 2. A lista genérica vira uma PRÉVIA COM OS DADOS DELA: as palavras que faltam
 *    no currículo, o cargo e a empresa da vaga. Nada disso custa chamada nova
 *    de IA — está tudo na análise que acabou de rodar. "Currículo reescrito"
 *    é abstrato; "seu currículo reescrito com benefícios, legislação e
 *    treinamento" é o problema dela resolvido.
 *
 * A nota projetada é TETO e a UI diz "até": o currículo reescrito só inclui
 * termos compatíveis com a experiência real da pessoa.
 *
 * O CTA continua sendo o cadastro, não o checkout — cobrar de quem não tem
 * conta exigiria criar cliente no Asaas antes de existir usuário.
 */
export function DossiePitch({
  score,
  projected,
  faltando = [],
  cargo,
  empresa,
}: {
  score?: number;
  projected?: number;
  faltando?: string[];
  cargo?: string | null;
  empresa?: string | null;
}) {
  const temCargo = !isCargoDesconhecido(cargo);
  const temEmpresa = !isEmpresaDesconhecida(empresa);
  const ganho =
    typeof score === "number" && typeof projected === "number" && projected > score;

  return (
    <section className="rounded-lg border-2 border-orange-500 bg-orange-soft/40 p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700">
        Próximo passo
      </p>
      <h2 className="mt-1 text-lg font-bold text-ink">
        Seu currículo reescrito para esta vaga, pronto para colar
      </h2>

      {ganho && (
        <p className="mt-2 text-sm leading-6 text-ink-2">
          Hoje ele tira <strong>{score}</strong>. Incorporando o que falta, a nota
          pode chegar a <strong className="text-orange-700">até {projected}</strong>.
        </p>
      )}

      <ul className="mt-4 space-y-2.5" aria-label="O que a preparação completa entrega">
        <Item destaque>
          {faltando.length > 0 ? (
            <>
              Currículo reescrito incluindo{" "}
              <Lista termos={faltando} />
            </>
          ) : (
            <>Currículo reescrito e ajustado para esta vaga</>
          )}
        </Item>
        <Item>
          {temEmpresa ? (
            <>
              Pesquisa atual sobre a <strong>{empresa}</strong>: notícias dos
              últimos 6 meses e contexto estratégico
            </>
          ) : (
            <>Pesquisa atual sobre a empresa: notícias dos últimos 6 meses</>
          )}
        </Item>
        <Item>
          Faixa salarial estimada
          {temCargo ? (
            <>
              {" "}para <strong>{cargo}</strong>
            </>
          ) : null}
        </Item>
        <Item>
          Perguntas prováveis com roteiro montado sobre a sua história
        </Item>
      </ul>

      <Link
        href="/signup"
        data-analytics-cta="anon_resultado_dossie"
        data-analytics-location="anon_ats_resultado"
        className="mt-5 inline-flex rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
      >
        Reescrever meu currículo · {precoCurto()} →
      </Link>
      <p className="mt-3 text-xs leading-5 text-ink-3">
        Primeiro você cria a conta (grátis) e sua análise já fica salva nela. O
        pagamento só aparece quando você mandar gerar. Sem assinatura, o crédito
        não expira e você tem 7 dias para pedir o dinheiro de volta.
      </p>
    </section>
  );
}

function Item({ children, destaque = false }: { children: React.ReactNode; destaque?: boolean }) {
  return (
    <li className={`flex gap-2.5 text-sm ${destaque ? "font-medium text-ink" : "text-ink-2"}`}>
      <span aria-hidden className="mt-0.5 shrink-0">
        🔒
      </span>
      <span className="leading-[1.5]">{children}</span>
    </li>
  );
}

function Lista({ termos }: { termos: string[] }) {
  return (
    <>
      {termos.map((t, i) => (
        <span key={t}>
          {i > 0 && (i === termos.length - 1 ? " e " : ", ")}
          <strong>{t}</strong>
        </span>
      ))}
    </>
  );
}
