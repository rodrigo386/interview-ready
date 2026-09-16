import { describe, it, expect, vi } from "vitest";
import {
  aplicarReguaFixa,
  buscarNoCv,
  calcularScore,
  calcularTitleMatch,
  normalizar,
  obterRegua,
  palavrasFaltando,
  projetarScore,
  sanitizeJdKeywords,
  type JdKeywords,
} from "./ats-keywords";
import type { AtsAnalysis } from "./schemas";

// A régua real da vaga de 10/09 (Analista Jr de RH), na versão de 7 críticas.
const REGUA: JdKeywords = {
  critical: [
    "atendimento", "benefícios", "indicadores", "integração",
    "legislação", "relatórios", "treinamento",
  ],
  high: ["folha de pagamento", "admissão"],
  medium: ["excel"],
};

const CV_V1 =
  "Analista de Pesquisa e Dados. Elaboração de relatórios e indicadores. " +
  "Atendimento ao público interno. Excel avançado.";
const CV_V2 =
  "Analista de RH Júnior. Elaboração de relatórios e indicadores. " +
  "Atendimento ao público interno. Processos de admissão. Excel avançado.";

/** O que a IA devolve — inclusive com a lista de palavras "errada". */
function respostaIa(patch: Partial<AtsAnalysis> = {}): AtsAnalysis {
  return {
    score: 99, // a IA erra a conta; o código refaz
    title_match: { cv_title: "x", jd_title: "Analista Jr", match_score: 33 },
    keyword_analysis: {
      critical: [{ keyword: "algo que a IA inventou", found: true }],
      high: [],
      medium: [],
    },
    top_fixes: [],
    overall_assessment: "Avaliação longa o bastante para o schema.",
    ...patch,
  };
}

describe("régua estável — o caso de 10/09", () => {
  it("mesma vaga, dois currículos: o conjunto de palavras avaliadas é idêntico", () => {
    const a = aplicarReguaFixa(respostaIa(), REGUA, CV_V1);
    const b = aplicarReguaFixa(
      respostaIa({
        keyword_analysis: { critical: [], high: [{ keyword: "outra coisa", found: false }], medium: [] },
      }),
      REGUA,
      CV_V2,
    );
    const lista = (x: AtsAnalysis) =>
      (["critical", "high", "medium"] as const).map((t) => x.keyword_analysis[t].map((k) => k.keyword));
    // Antes: 6 críticas numa rodada e 7 na outra, com a mesma vaga.
    expect(lista(a)).toEqual(lista(b));
  });

  it("a nota só muda pelo que mudou no currículo", () => {
    const a = aplicarReguaFixa(respostaIa(), REGUA, CV_V1);
    const b = aplicarReguaFixa(respostaIa(), REGUA, CV_V2);
    // A v2 só acrescenta "admissão" (high, peso 2). Com mesmo título, a
    // diferença de nota tem que vir inteira disso.
    expect(b.score).toBeGreaterThan(a.score);
    const achadas = (x: AtsAnalysis) =>
      [...x.keyword_analysis.critical, ...x.keyword_analysis.high].filter((k) => k.found).length;
    expect(achadas(b) - achadas(a)).toBe(1);
  });

  it("ignora a nota e a lista que a IA devolveu", () => {
    const r = aplicarReguaFixa(respostaIa(), REGUA, CV_V1);
    expect(r.score).not.toBe(99);
    expect(r.keyword_analysis.critical.map((k) => k.keyword)).not.toContain(
      "algo que a IA inventou",
    );
  });

  it("guarda a régua na análise, pra próxima rodada reaproveitar", () => {
    expect(aplicarReguaFixa(respostaIa(), REGUA, CV_V1).jd_keywords).toEqual(REGUA);
  });
});

describe("buscarNoCv", () => {
  it("não diferencia acento nem caixa", () => {
    expect(buscarNoCv("LEGISLACAO trabalhista", "legislação").found).toBe(true);
  });

  it("casa termo inteiro, nunca pedaço de palavra", () => {
    expect(buscarNoCv("rhythm and blues", "rh").found).toBe(false);
    expect(buscarNoCv("experiência em RH e DP", "rh").found).toBe(true);
  });

  it("casa frase com quebra de linha no meio", () => {
    expect(buscarNoCv("folha de\n  pagamento mensal", "folha de pagamento").found).toBe(true);
  });

  it("devolve contexto do texto ORIGINAL, com acento", () => {
    const r = buscarNoCv("Responsável pela legislação trabalhista e benefícios", "legislacao");
    expect(r.context).toContain("legislação");
    expect(r.context!.length).toBeLessThanOrEqual(80);
  });
});

describe("calcularScore", () => {
  const kw = (c: boolean[], h: boolean[], m: boolean[]) => ({
    critical: c.map((found, i) => ({ keyword: `c${i}`, found })),
    high: h.map((found, i) => ({ keyword: `h${i}`, found })),
    medium: m.map((found, i) => ({ keyword: `m${i}`, found })),
  });

  it("aplica pesos 3/2/1 e bônus de título", () => {
    // max = 2*3 + 1*2 = 8; ganho = 3 + 2 = 5; round(5/8*90)=56; bônus 50/10=5
    expect(calcularScore(kw([true, false], [true], []), 50)).toBe(61);
  });

  it("vaga sem palavras-chave não vira NaN", () => {
    expect(calcularScore(kw([], [], []), 40)).toBe(4);
  });

  it("nunca passa de 100", () => {
    expect(calcularScore(kw([true], [], []), 100)).toBe(100);
  });
});

describe("sanitizeJdKeywords", () => {
  it("remove duplicata entre faixas, mantendo a de peso maior", () => {
    const r = sanitizeJdKeywords({ critical: ["Excel"], high: ["excel"], medium: [] });
    expect(r.critical).toEqual(["Excel"]);
    expect(r.high).toEqual([]);
  });

  it("ordem de entrada não muda a saída", () => {
    const a = sanitizeJdKeywords({ critical: ["b", "a"], high: [], medium: [] });
    const b = sanitizeJdKeywords({ critical: ["a", "b"], high: [], medium: [] });
    expect(a).toEqual(b);
  });

  it("respeita os tetos", () => {
    const r = sanitizeJdKeywords({
      critical: Array.from({ length: 20 }, (_, i) => `k${i}`),
      high: [],
      medium: [],
    });
    expect(r.critical).toHaveLength(8);
  });
});

describe("obterRegua", () => {
  it("reaproveita a régua de análise anterior sem chamar a IA", async () => {
    const extract = vi.fn();
    const r = await obterRegua("vaga", { findCached: async () => REGUA, extract });
    expect(extract).not.toHaveBeenCalled();
    expect(r.critical).toHaveLength(7);
  });

  it("extrai quando não há régua anterior", async () => {
    const extract = vi.fn(async () => REGUA);
    await obterRegua("vaga", { findCached: async () => null, extract });
    expect(extract).toHaveBeenCalledWith("vaga");
  });

  it("falha do cache cai na extração em vez de derrubar a análise", async () => {
    const extract = vi.fn(async () => REGUA);
    await obterRegua("vaga", {
      findCached: async () => { throw new Error("db fora"); },
      extract,
    });
    expect(extract).toHaveBeenCalled();
  });
});

describe("normalizar", () => {
  it("colapsa espaço, tira acento e caixa", () => {
    expect(normalizar("  Folha   de Pagamento\n")).toBe("folha de pagamento");
    expect(normalizar("Benefícios")).toBe("beneficios");
  });
});

describe("calcularTitleMatch", () => {
  it("reproduz os títulos de 10/09", () => {
    // "analista de pesquisa e dados" x "analista jr": 1 comum de 4 → 25
    expect(calcularTitleMatch("Analista de Pesquisa e Dados", "Analista Jr")).toBe(25);
    // "analista rh junior" x "analista junior": 2 comuns de 3 → 67. A
    // reescrita de título dela TEM que render nota — foi uma melhora real.
    expect(calcularTitleMatch("Analista de RH Júnior", "Analista Jr")).toBe(67);
  });

  it("ignora caixa, acento e preposição", () => {
    expect(calcularTitleMatch("Gerente de Operações", "GERENTE OPERACOES")).toBe(100);
  });

  it("abreviação de senioridade equivale à palavra inteira", () => {
    expect(calcularTitleMatch("Desenvolvedor Sr.", "Desenvolvedor Sênior")).toBe(100);
    expect(calcularTitleMatch("Analista Pl", "Analista Pleno")).toBe(100);
  });

  it("título vazio é zero, não NaN", () => {
    expect(calcularTitleMatch("", "Analista")).toBe(0);
  });

  it("a mesma dupla de títulos sempre dá a mesma nota", () => {
    const n = calcularTitleMatch("Desenvolvedor Full Stack Pleno", "Desenvolvedor .NET Pleno");
    expect(calcularTitleMatch("Desenvolvedor Full Stack Pleno", "Desenvolvedor .NET Pleno")).toBe(n);
  });
});

describe("palavrasFaltando e projetarScore", () => {
  const base = (patch: Partial<AtsAnalysis> = {}): AtsAnalysis => ({
    score: 34,
    title_match: { cv_title: "a", jd_title: "b", match_score: 30 },
    keyword_analysis: {
      critical: [
        { keyword: "benefícios", found: false },
        { keyword: "relatórios", found: true },
        { keyword: "legislação", found: false },
      ],
      high: [{ keyword: "admissão", found: false }],
      medium: [{ keyword: "excel", found: false }],
    },
    top_fixes: [],
    overall_assessment: "Avaliação longa o bastante para o schema.",
    ...patch,
  });

  it("lista as que faltam, críticas antes das importantes", () => {
    expect(palavrasFaltando(base())).toEqual(["benefícios", "legislação", "admissão"]);
  });

  it("respeita o máximo", () => {
    expect(palavrasFaltando(base(), 1)).toEqual(["benefícios"]);
  });

  it("projeta pela fórmula real: críticas e importantes presentes, título igual", () => {
    // max = 3*3 + 1*2 + 1*1 = 12; ganho = 9 + 2 = 11 → round(11/12*90)=83; +3 de título
    expect(projetarScore(base())).toBe(86);
  });

  it("nunca projeta abaixo da nota atual (análises antigas com nota da IA)", () => {
    expect(projetarScore(base({ score: 95 }))).toBe(95);
  });

  it("CV que já tem tudo não ganha projeção", () => {
    const completa = base({
      // coerente com a fórmula: 3/3 → 90, + round(30/10)=3
      score: 93,
      keyword_analysis: {
        critical: [{ keyword: "a", found: true }],
        high: [],
        medium: [],
      },
    });
    expect(palavrasFaltando(completa)).toEqual([]);
    expect(projetarScore(completa)).toBe(completa.score);
  });
});
