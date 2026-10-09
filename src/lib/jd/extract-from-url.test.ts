import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini", () => ({ cleanJobDescription: async (t: string) => t }));

import {
  extractJdFromUrl,
  MAX_TEXT_CHARS,
  pareceDescricaoDeVaga,
  urlDeVagaValida,
} from "./extract-from-url";

const VAGA =
  "Analista Administrativo. Responsabilidades: conciliação bancária, emissão de notas e apoio às rotinas financeiras da empresa. " +
  "Requisitos: ensino médio completo, experiência na área administrativa e conhecimentos de Excel. Benefícios: vale-transporte e convênio médico.";

const SO_BENEFICIOS =
  "Por que trabalhar aqui? Conheça nossos benefícios. Plano de saúde, plano odontológico e seguro de vida. Restaurante com comida caseira todos os dias, " +
  "mercadinho, área para marmita, voucher de alimentação, incentivo à educação, auxílio creche, vale transporte, estacionamento e bicicletário para todos.";

describe("pareceDescricaoDeVaga", () => {
  it("reconhece uma descrição de vaga (PT)", () => {
    expect(pareceDescricaoDeVaga(VAGA)).toBe(true);
  });

  it("reconhece em inglês", () => {
    expect(
      pareceDescricaoDeVaga("About the role. Responsibilities include X. Requirements: 3 years of experience."),
    ).toBe(true);
  });

  it("ignora acento e caixa", () => {
    expect(pareceDescricaoDeVaga("RESPONSABILIDADES e QUALIFICAÇÕES do cargo")).toBe(true);
  });

  it("recusa a vaga que veio só com o bloco de benefícios (caso real da Gupy)", () => {
    expect(pareceDescricaoDeVaga(SO_BENEFICIOS)).toBe(false);
  });

  it("recusa uma página de lista ou de erro", () => {
    expect(pareceDescricaoDeVaga("Não encontramos resultados para a sua busca. Dicas: evite abreviações.")).toBe(false);
    expect(pareceDescricaoDeVaga("Vagas de Analista de Custos em Brasil (4.000+ vagas). Entre para criar um alerta.")).toBe(false);
  });

  it("um sinal solto não basta (texto institucional também diz 'experiência em')", () => {
    expect(pareceDescricaoDeVaga("Nossa empresa tem experiência em varejo desde 1990.")).toBe(false);
  });
});

describe("urlDeVagaValida", () => {
  it("aceita http(s) de um site de verdade e normaliza", () => {
    expect(urlDeVagaValida("  https://empresa.gupy.io/jobs/123?jobBoardSource=x ")).toEqual({
      ok: true,
      url: "https://empresa.gupy.io/jobs/123?jobBoardSource=x",
    });
    expect(urlDeVagaValida("http://www.catho.com.br/vagas/x/1/").ok).toBe(true);
  });

  it.each([
    "",
    "   ",
    "não é url",
    "ftp://empresa.com/vaga",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "http://localhost:3000/vaga",
    "http://intranet/vaga",
    "http://192.168.0.1/vaga",
    "http://127.0.0.1/vaga",
    "http://[::1]/vaga",
    "https://servidor.local/vaga",
    "https://api.internal/vaga",
    "https://empresa.com/" + "a".repeat(2000),
  ])("recusa %s", (entrada) => {
    expect(urlDeVagaValida(entrada).ok).toBe(false);
  });
});

describe("extractJdFromUrl", () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const resposta = (corpo: string, status = 200) => ({ ok: status < 400, status, text: async () => corpo });

  it("chama o Jina com a URL e devolve o texto da vaga", async () => {
    fetchMock.mockResolvedValue(resposta(`Title: Vaga\nURL Source: https://x.com/v\nMarkdown Content:\n${VAGA}`));
    const r = await extractJdFromUrl("https://x.com/v");
    expect(fetchMock.mock.calls[0][0]).toBe("https://r.jina.ai/https://x.com/v");
    expect(r).toEqual({ ok: true, text: expect.stringContaining("Requisitos") });
  });

  it("erro de rede vira 'rede' e oferece colar o texto", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("timeout"));
    const r = await extractJdFromUrl("https://x.com/v");
    expect(r).toMatchObject({ ok: false, motivo: "rede" });
    expect((r as { error: string }).error).toMatch(/cole o texto da vaga/i);
  });

  it("HTTP de erro vira 'http'", async () => {
    fetchMock.mockResolvedValue(resposta("", 403));
    expect(await extractJdFromUrl("https://x.com/v")).toMatchObject({ ok: false, motivo: "http" });
  });

  it("página com pouco texto vira 'pouco_texto'", async () => {
    fetchMock.mockResolvedValue(resposta("curto demais"));
    expect(await extractJdFromUrl("https://x.com/v")).toMatchObject({ ok: false, motivo: "pouco_texto" });
  });

  it("só com a opção, recusa texto que não parece vaga", async () => {
    fetchMock.mockResolvedValue(resposta(SO_BENEFICIOS));
    expect(await extractJdFromUrl("https://x.com/v", { exigirSinaisDeVaga: true })).toMatchObject({
      ok: false,
      motivo: "nao_parece_vaga",
    });
    // sem a opção (usuário logado) o comportamento anterior continua: passa
    expect((await extractJdFromUrl("https://x.com/v")).ok).toBe(true);
  });

  it("corta no limite máximo de caracteres", async () => {
    fetchMock.mockResolvedValue(resposta(VAGA + " x".repeat(MAX_TEXT_CHARS)));
    const r = await extractJdFromUrl("https://x.com/v");
    expect(r.ok && r.text.length).toBe(MAX_TEXT_CHARS);
  });
});
