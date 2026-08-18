import { PER_USE_AMOUNT_CENTS, brlLabel, centsToBrl } from "./prices";

/**
 * O que a preparação completa entrega, em uma lista só.
 *
 * Existia em dois lugares divergentes (a seção da landing e o CTA dentro da
 * prep) e faltava justamente onde a intenção é maior: a página de resultado da
 * análise grátis. Uma fonte só evita que a promessa mude de página pra página.
 */
export const DOSSIE_INCLUI = [
  "Currículo reescrito para ATS, pronto para colar",
  "A empresa pesquisada agora: notícias dos últimos 6 meses e contexto estratégico",
  "15 perguntas prováveis com roteiro STAR montado sobre a sua história",
  "As perguntas que você faz ao recrutador, calibradas pela vaga e pelo seu nível",
  "Faixa salarial estimada para o cargo e a senioridade",
] as const;

/**
 * "R$10" em vez de "R$ 10,00" para uso em headline, chip e rótulo de botão,
 * onde os centavos zerados só ocupam espaço. Valores quebrados caem no
 * formato completo, porque aí o centavo importa.
 */
export function precoCurto(cents: number = PER_USE_AMOUNT_CENTS): string {
  const brl = centsToBrl(cents);
  return Number.isInteger(brl) ? `R$${brl}` : brlLabel(cents);
}
