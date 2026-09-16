import type { AtsAnalysis, AtsKeyword } from "@/lib/ai/schemas";

/**
 * A RÉGUA do score ATS: as palavras-chave da vaga, extraídas SÓ da vaga.
 *
 * Por que existe: em 10/09 uma usuária analisou a mesma vaga duas vezes
 * (hash MD5 idêntico) com duas versões do currículo. A primeira análise
 * listou 6 palavras críticas, a segunda 7 — "benefícios" apareceu do nada — e
 * o total de pontos possíveis foi de 37 para 39. Ela tinha reescrito o título
 * do CV e ganhou +4; metade disso era a régua se mexendo, não o currículo
 * melhorando.
 *
 * A causa: extração (só deveria olhar a vaga) e comparação (olha o CV) eram
 * uma chamada só, e o currículo contaminava o que a IA considerava "crítico".
 * `temperature: 0` não resolve isso — deixa a resposta estável PARA A MESMA
 * ENTRADA, e a entrada mudou (o CV).
 *
 * O conserto tem três partes:
 *  1. extração numa chamada que recebe apenas o texto da vaga;
 *  2. reuso dessa extração quando a mesma vaga já foi analisada antes — é o
 *     que garante que reanalisar a vaga compare contra a MESMA régua;
 *  3. comparação com o CV e cálculo do score feitos AQUI, em código. Ambos
 *     são regras mecânicas (busca literal + fórmula), e código não tem
 *     variação de amostragem.
 */
export type JdKeywords = {
  critical: string[];
  high: string[];
  medium: string[];
};

export const KEYWORD_CAPS = { critical: 8, high: 8, medium: 6 } as const;

const PESOS = { critical: 3, high: 2, medium: 1 } as const;

/**
 * Normaliza pra comparação: minúsculas, sem acento, espaços colapsados.
 *
 * Sem acento de propósito: "legislacao" num PDF mal convertido e "legislação"
 * na vaga são a mesma competência, e um filtro de verdade não reprovaria
 * alguém por um cedilha perdido na extração do arquivo.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Limpa, deduplica (normalizado) e aplica os tetos de cada faixa. */
export function sanitizeJdKeywords(raw: JdKeywords): JdKeywords {
  const vistos = new Set<string>();
  const faixa = (lista: string[], teto: number) => {
    const out: string[] = [];
    for (const k of lista ?? []) {
      const limpa = (k ?? "").replace(/\s+/g, " ").trim();
      const chave = normalizar(limpa);
      if (!chave || vistos.has(chave)) continue;
      vistos.add(chave);
      out.push(limpa);
      if (out.length >= teto) break;
    }
    // Ordem alfabética: a mesma lista de entrada sempre produz a mesma saída,
    // independente da ordem em que a IA devolveu.
    return out.sort((a, b) => normalizar(a).localeCompare(normalizar(b)));
  };
  // A ordem das chamadas importa: uma palavra que aparece em duas faixas fica
  // na de peso maior.
  const critical = faixa(raw.critical, KEYWORD_CAPS.critical);
  const high = faixa(raw.high, KEYWORD_CAPS.high);
  const medium = faixa(raw.medium, KEYWORD_CAPS.medium);
  return { critical, high, medium };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Procura a palavra-chave no CV como termo inteiro (não pedaço de palavra:
 * "rh" não pode casar dentro de "rhythm") e devolve um trecho do CV ORIGINAL
 * em volta, pra mostrar à pessoa onde foi encontrado.
 */
export function buscarNoCv(cvText: string, keyword: string): AtsKeyword {
  const alvo = normalizar(keyword);
  if (!alvo) return { keyword, found: false };

  // Normaliza caractere a caractere guardando de onde cada um veio, pra poder
  // recortar o contexto no texto original (com acentos e quebras de linha).
  let norm = "";
  const origem: number[] = [];
  let ultimoEspaco = false;
  for (let i = 0; i < cvText.length; i++) {
    const c = cvText[i]
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    for (const ch of c) {
      const espaco = /\s/.test(ch);
      if (espaco && ultimoEspaco) continue;
      norm += espaco ? " " : ch;
      origem.push(i);
      ultimoEspaco = espaco;
    }
  }

  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(alvo)}(?=$|[^\\p{L}\\p{N}])`, "u");
  const m = re.exec(norm);
  if (!m) return { keyword, found: false };

  const iniNorm = m.index + m[1].length;
  const ini = origem[iniNorm] ?? 0;
  const fim = origem[iniNorm + alvo.length - 1] ?? ini;
  const folga = Math.max(0, Math.floor((80 - (fim - ini + 1)) / 2));
  const context = cvText
    .slice(Math.max(0, ini - folga), Math.min(cvText.length, fim + 1 + folga))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return { keyword, found: true, context };
}

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "a", "o", "para", "com",
  "of", "the", "and", "for", "in", "to", "-", "/", "|",
]);

/**
 * Abreviações de senioridade são a MESMA palavra para quem recruta. Sem isto,
 * "Analista de RH Júnior" contra a vaga "Analista Jr" dava a mesma nota que
 * "Analista de Pesquisa e Dados" — e a usuária de 10/09, que reescreveu o
 * título justamente pra se alinhar à vaga, não receberia crédito nenhum por
 * isso. Lista curta e fechada de propósito: sinônimo livre é por onde a
 * regra deixa de ser regra.
 */
const SENIORIDADE: Record<string, string> = {
  jr: "junior",
  sr: "senior",
  pl: "pleno",
  estag: "estagio",
  estagiario: "estagio",
  estagiaria: "estagio",
};

/**
 * Aderência de título (0–100): Jaccard entre as palavras do cargo no CV e o
 * cargo da vaga. É o STEP 4 do prompt, que é conta, não interpretação — a IA
 * continua lendo QUAL é o título de cada lado, mas a nota sai daqui.
 */
export function calcularTitleMatch(cvTitle: string, jdTitle: string): number {
  const tokens = (t: string) =>
    new Set(
      normalizar(t)
        .split(/[\s/|,()-]+/)
        .map((w) => w.replace(/\.$/, ""))
        .map((w) => SENIORIDADE[w] ?? w)
        .filter((w) => w && !STOPWORDS.has(w)),
    );
  const a = tokens(cvTitle);
  const b = tokens(jdTitle);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return Math.round((inter / (a.size + b.size - inter)) * 100);
}

/** Mesma fórmula que o prompt descrevia, agora executada de verdade. */
export function calcularScore(
  kw: AtsAnalysis["keyword_analysis"],
  titleMatchScore: number,
): number {
  const soma = (tier: keyof typeof PESOS, soAchadas: boolean) =>
    kw[tier].filter((k) => !soAchadas || k.found).length * PESOS[tier];
  const max = soma("critical", false) + soma("high", false) + soma("medium", false);
  const ganho = soma("critical", true) + soma("high", true) + soma("medium", true);
  const base = max === 0 ? 0 : Math.round((ganho / max) * 90);
  const bonus = Math.round(Math.max(0, Math.min(100, titleMatchScore)) / 10);
  return Math.max(0, Math.min(100, base + bonus));
}

/**
 * Aplica a régua fixa sobre a resposta da IA.
 *
 * A IA continua responsável pelo que é interpretação — alinhamento de título,
 * sugestões de reescrita, avaliação geral. O que é regra mecânica (quais
 * palavras, se estão no CV, qual a nota) passa a ser decidido aqui e
 * sobrescreve o que a IA tiver devolvido.
 */
export function aplicarReguaFixa(
  analysis: AtsAnalysis,
  keywords: JdKeywords,
  cvText: string,
): AtsAnalysis {
  const keyword_analysis = {
    critical: keywords.critical.map((k) => buscarNoCv(cvText, k)),
    high: keywords.high.map((k) => buscarNoCv(cvText, k)),
    medium: keywords.medium.map((k) => buscarNoCv(cvText, k)),
  };

  // Sugestão de ajuste para algo que o CV JÁ contém contradiz a própria
  // análise na tela. Só essas saem; sugestões com redação diferente da
  // palavra-chave ficam, porque descartá-las por não bater letra a letra
  // apagaria conselho válido.
  const presentes = new Set(
    [...keyword_analysis.critical, ...keyword_analysis.high, ...keyword_analysis.medium]
      .filter((k) => k.found)
      .map((k) => normalizar(k.keyword)),
  );
  const top_fixes = analysis.top_fixes
    .filter((f) => !presentes.has(normalizar(f.gap)))
    .map((f, i) => ({ ...f, priority: i + 1 }));

  const title_match = {
    ...analysis.title_match,
    match_score: calcularTitleMatch(
      analysis.title_match.cv_title,
      analysis.title_match.jd_title,
    ),
  };

  return {
    ...analysis,
    title_match,
    keyword_analysis,
    top_fixes,
    score: calcularScore(keyword_analysis, title_match.match_score),
    jd_keywords: keywords,
  };
}

export type RulerDeps = {
  /** Régua já extraída numa análise anterior da mesma vaga, se houver. */
  findCached: (jdText: string) => Promise<JdKeywords | null>;
  /** Extração nova, com a IA vendo SÓ a vaga. */
  extract: (jdText: string) => Promise<JdKeywords>;
};

/**
 * Régua da vaga: reaproveita a de uma análise anterior da mesma vaga ou extrai
 * uma nova. Falha do cache nunca derruba a análise — cai na extração.
 */
export async function obterRegua(jdText: string, deps: RulerDeps): Promise<JdKeywords> {
  try {
    const cached = await deps.findCached(jdText);
    if (cached) return sanitizeJdKeywords(cached);
  } catch (err) {
    console.warn("[ats-keywords] leitura do cache da régua falhou:", err);
  }
  return sanitizeJdKeywords(await deps.extract(jdText));
}
