/**
 * O dia comercial do produto é o dia no Brasil, não em UTC.
 *
 * O Postgres do Supabase roda em UTC e `created_at` volta em UTC. Agrupar por
 * `created_at.slice(0, 10)` — que era o que o gráfico diário do /admin fazia —
 * usa a data UTC, e o Brasil está 3 horas atrás: tudo que acontece aqui entre
 * 21h e meia-noite cai na barra do DIA SEGUINTE.
 *
 * Isso não é detalhe cosmético num produto de candidatura a vaga. As pessoas
 * mexem em currículo à noite, depois do trabalho — justamente a faixa que o
 * recorte UTC empurra pra frente. O pico diário aparecia no dia errado, e um
 * dia inteiro de atividade noturna podia ser lido como "dia fraco seguido de
 * dia forte" quando foi um só.
 *
 * Descoberto em 04/09, quando uma consulta de "hoje" devolveu zero em tudo às
 * 23h46 de Brasília: o banco já estava no dia seguinte.
 *
 * `Intl` em vez de subtrair 3 horas na mão porque o offset não é uma
 * constante — o Brasil já teve horário de verão e pode voltar a ter. A
 * biblioteca sabe a regra vigente em cada data; um `-3` chumbado erraria
 * silenciosamente em qualquer série histórica que cruze uma mudança dessas.
 */
export const FUSO_BRASIL = "America/Sao_Paulo";

// "en-CA" formata como YYYY-MM-DD, que é exatamente a chave que os buckets
// usam e a ordenação lexicográfica que o gráfico espera.
const FORMATADOR = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_BRASIL,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data (YYYY-MM-DD) do instante, no fuso do Brasil. */
export function toBrazilDay(instante: string | number | Date): string {
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return "";
  return FORMATADOR.format(d);
}

/**
 * Os últimos `dias` dias brasileiros, do mais antigo ao mais recente,
 * incluindo hoje. Caminha de 24 em 24 horas a partir de agora e formata cada
 * ponto no fuso alvo — sem construir data local, que herdaria o fuso da
 * máquina (o servidor do Railway roda em UTC).
 */
export function ultimosDiasBrasil(dias: number, agora: number = Date.now()): string[] {
  const DIA_MS = 24 * 60 * 60 * 1000;
  const saida: string[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    saida.push(toBrazilDay(agora - i * DIA_MS));
  }
  return saida;
}
