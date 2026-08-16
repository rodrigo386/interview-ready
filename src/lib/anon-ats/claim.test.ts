import { describe, it, expect, vi } from "vitest";
import { claimAnonAnalysis } from "./claim";
import type { PrepSessionInsert } from "./core";

const row = {
  id: "anon-1",
  cv_text: "Analista de RH com 8 anos de experiência.",
  job_description: "Gerente de RH generalista.",
  job_title: "Gerente de RH",
  company_name: "Acme",
  analysis: { score: 62, top_fixes: [] } as never,
  model_used: "cerebras",
  claimed_by: null,
  expires_at: "2099-01-01T00:00:00Z",
};

describe("claimAnonAnalysis", () => {
  it("cria a prep e marca a linha como reivindicada", async () => {
    // Tipa o parâmetro explicitamente: vi.fn(async () => ...) sem anotação
    // infere `[]` como tupla de parâmetros e quebra o acesso a
    // `mock.calls[0][0]` abaixo sob TS strict (noUncheckedIndexedAccess).
    const insertPrep = vi.fn(async (_insert: PrepSessionInsert) => "prep-1");
    const mark = vi.fn(async () => true);

    const id = await claimAnonAnalysis("tok", "user-1", {
      getRow: async () => row,
      insertPrep,
      markClaimed: mark,
    });

    expect(id).toBe("prep-1");
    expect(mark).toHaveBeenCalledWith("tok", "user-1");
    expect(insertPrep.mock.calls[0][0].ats_status).toBe("complete");
  });

  it("prep criada mas markClaimed falhou: devolve a prep e loga aviso distinguível", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const insertPrep = vi.fn(async (_insert: PrepSessionInsert) => "prep-1");
    const mark = vi.fn(async () => false);

    const id = await claimAnonAnalysis("tok", "user-1", {
      getRow: async () => row,
      insertPrep,
      markClaimed: mark,
    });

    // Prep já foi criada com sucesso — inserir → marcar, nunca a ordem
    // inversa, então perder o "marcar" não pode apagar o resultado do
    // "inserir" pro usuário. O risco (token reutilizável) fica só logado.
    expect(id).toBe("prep-1");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string];
    expect(message).toContain("prep-1");
    expect(message).toContain("tok");

    warnSpy.mockRestore();
  });

  it("não cria segunda prep para token já reivindicado", async () => {
    const insertPrep = vi.fn(async () => "prep-2");

    const id = await claimAnonAnalysis("tok", "user-1", {
      getRow: async () => ({ ...row, claimed_by: "outro-user" }),
      insertPrep,
      markClaimed: async () => true,
    });

    expect(id).toBeNull();
    expect(insertPrep).not.toHaveBeenCalled();
  });

  it("devolve null quando a análise expirou ou não existe", async () => {
    const id = await claimAnonAnalysis("tok", "user-1", {
      getRow: async () => null,
      insertPrep: vi.fn(),
      markClaimed: vi.fn(),
    });
    expect(id).toBeNull();
  });
});
