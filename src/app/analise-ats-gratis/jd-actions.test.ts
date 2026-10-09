import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.fn();
const extract = vi.fn();
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "203.0.113.9, 10.0.0.1"]]),
}));
vi.mock("@/lib/ratelimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/ratelimit")>()),
  rateLimit: (...a: unknown[]) => rateLimit(...a),
}));
vi.mock("@/lib/anon-ats/repo", () => ({ hashIp: () => null }));
vi.mock("@/lib/jd/extract-from-url", async (orig) => ({
  ...(await orig<typeof import("@/lib/jd/extract-from-url")>()),
  extractJdFromUrl: (...a: unknown[]) => extract(...a),
}));

import { LIMITS } from "@/lib/ratelimit";
import { fetchJdFromUrlAnon } from "./jd-actions";

const OK = { success: true, remaining: 3, reset: 0 };
const NEGADO = { success: false, remaining: 0, reset: 0 };

beforeEach(() => {
  rateLimit.mockReset().mockResolvedValue(OK);
  extract.mockReset().mockResolvedValue({ ok: true, text: "Requisitos: Excel. Responsabilidades: conciliação." });
});

describe("fetchJdFromUrlAnon", () => {
  it("URL inválida é recusada ANTES de gastar limite ou chamada", async () => {
    for (const ruim of ["", "http://localhost/x", "ftp://a.com/x", "http://10.0.0.1/x"]) {
      expect(await fetchJdFromUrlAnon(ruim)).toMatchObject({ ok: false, motivo: "url_invalida" });
    }
    expect(rateLimit).not.toHaveBeenCalled();
    expect(extract).not.toHaveBeenCalled();
  });

  it("os dois limites existem e FALHAM FECHADO (sem Redis, recusa em vez de liberar)", () => {
    expect(LIMITS.anonFetchJd.failClosed).toBe(true);
    expect(LIMITS.anonFetchJdGlobal.failClosed).toBe(true);
  });

  it("limite por IP estourado: recusa, avisa que dá pra colar o texto e não busca nada", async () => {
    rateLimit.mockResolvedValueOnce(NEGADO);
    const r = await fetchJdFromUrlAnon("https://empresa.com/vagas/1");
    expect(r).toMatchObject({ ok: false, motivo: "limite" });
    expect((r as { error: string }).error).toMatch(/cole no campo/i);
    expect(extract).not.toHaveBeenCalled();
  });

  it("disjuntor global estourado: recusa mesmo com o IP dentro do limite", async () => {
    rateLimit.mockResolvedValueOnce(OK).mockResolvedValueOnce(NEGADO);
    expect(await fetchJdFromUrlAnon("https://empresa.com/vagas/1")).toMatchObject({ ok: false, motivo: "limite" });
    expect(extract).not.toHaveBeenCalled();
  });

  it("usa o primeiro IP do x-forwarded-for e o limite certo por IP", async () => {
    await fetchJdFromUrlAnon("https://empresa.com/vagas/1");
    expect(rateLimit.mock.calls[0]).toEqual(["anonFetchJd:203.0.113.9", LIMITS.anonFetchJd]);
    expect(rateLimit.mock.calls[1]).toEqual(["anonFetchJd:global", LIMITS.anonFetchJdGlobal]);
  });

  it("extrai EXIGINDO que o texto pareça uma vaga, e devolve o host sem www", async () => {
    const r = await fetchJdFromUrlAnon("https://www.catho.com.br/vagas/analista/123/");
    expect(extract).toHaveBeenCalledWith("https://www.catho.com.br/vagas/analista/123/", { exigirSinaisDeVaga: true });
    expect(r).toEqual({ ok: true, text: expect.stringContaining("Requisitos"), host: "catho.com.br" });
  });

  it("repassa o motivo quando a extração falha", async () => {
    extract.mockResolvedValue({ ok: false, motivo: "nao_parece_vaga", error: "Essa página não parece trazer a descrição da vaga" });
    expect(await fetchJdFromUrlAnon("https://x.com/v")).toMatchObject({ ok: false, motivo: "nao_parece_vaga" });
  });

  it("qualquer exceção inesperada vira erro TRATADO (não derruba a página) e oferece colar o texto", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    rateLimit.mockRejectedValue(new Error("Invalid environment variables"));
    const r = await fetchJdFromUrlAnon("https://empresa.com/vagas/1");
    expect(r).toMatchObject({ ok: false, motivo: "erro" });
    expect((r as { error: string }).error).toMatch(/cole no campo/i);
    expect(extract).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("exceção na extração também vira erro tratado", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    extract.mockRejectedValue(new Error("boom"));
    expect(await fetchJdFromUrlAnon("https://empresa.com/vagas/1")).toMatchObject({ ok: false, motivo: "erro" });
    spy.mockRestore();
  });
});
