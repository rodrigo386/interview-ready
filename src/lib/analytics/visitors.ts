/**
 * Separa visitante provado de visitante suposto, sem coletar nada novo.
 *
 * O problema: `pv_vid` é gerado no cliente e vive 1 ano. Navegador de verdade
 * guarda o cookie e reaparece com o MESMO id. Rastreador automatizado que
 * descarta cookie nasce com um id novo a cada requisição — e cada acesso dele
 * entra na contagem como "visitante único".
 *
 * Foi assim que a semana de 2026-08-17 marcou 153 únicos: cinco páginas sem
 * relação nenhuma entre si (`/termos`, `/lgpd`, `/privacidade`, `/login`,
 * `/signup`) tinham EXATAMENTE 17 visitantes de uma view cada — assinatura de
 * varredura, não de gente. Os humanos daquela semana eram ~25.
 *
 * O sinal: reaparecer com o mesmo id PROVA que o cookie sobreviveu, e é
 * justamente o que um cliente que descarta cookie nunca consegue fazer. Não
 * exige IP, fingerprint, nem coluna nova — dá pra recalcular a série
 * histórica inteira com os dados que já estão no banco.
 *
 * O QUE ISTO NÃO É: `unconfirmed` não quer dizer "bot". Uma pessoa real que
 * cai de busca num artigo e sai sem clicar em nada também fica sem prova.
 * Por isso os dois números são reportados lado a lado em vez de um "total
 * limpo" — `confirmed` é PISO de gente real, `visitors` é TETO, e a verdade
 * mora entre os dois. Qualquer painel que mostre um só dos dois volta a
 * mentir, só que na outra direção.
 */

export type VisitorRow = {
  visitor_id: string;
  created_at: string;
};

export type TrafficWindow = {
  /** Total de page views na janela. */
  views: number;
  /** Distintos `visitor_id` — o número antigo, mantido como TETO. */
  visitors: number;
  /** Visitantes que reapareceram com o mesmo id. PISO de gente real. */
  confirmed: number;
  /** Vistos uma vez só: pode ser varredura, pode ser bounce legítimo. */
  unconfirmed: number;
};

/** Avistamentos necessários pra provar que o cookie sobreviveu. */
export const MIN_SIGHTINGS_TO_CONFIRM = 2;

/**
 * Conta avistamentos por visitante em TODA a série, não só na janela.
 *
 * Tem que ser global: quem visitou ontem e voltou hoje provou o cookie, e
 * contar só dentro de uma janela de 24h marcaria essa pessoa como não
 * confirmada por acidente de recorte.
 */
export function buildSightingIndex(rows: VisitorRow[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const r of rows) {
    index.set(r.visitor_id, (index.get(r.visitor_id) ?? 0) + 1);
  }
  return index;
}

export function isConfirmedVisitor(
  visitorId: string,
  index: Map<string, number>,
): boolean {
  return (index.get(visitorId) ?? 0) >= MIN_SIGHTINGS_TO_CONFIRM;
}

/**
 * Resume uma janela. `cutoffMs === null` = desde sempre.
 */
export function summarizeWindow(
  rows: VisitorRow[],
  index: Map<string, number>,
  cutoffMs: number | null,
): TrafficWindow {
  const naJanela = new Set<string>();
  let views = 0;

  for (const r of rows) {
    if (cutoffMs !== null) {
      const t = new Date(r.created_at).getTime();
      // Data inválida não pode virar "agora" nem sumir em silêncio: fica de
      // fora da janela e continua contando no índice global.
      if (Number.isNaN(t) || t < cutoffMs) continue;
    }
    views++;
    naJanela.add(r.visitor_id);
  }

  let confirmed = 0;
  for (const id of naJanela) {
    if (isConfirmedVisitor(id, index)) confirmed++;
  }

  return {
    views,
    visitors: naJanela.size,
    confirmed,
    unconfirmed: naJanela.size - confirmed,
  };
}
