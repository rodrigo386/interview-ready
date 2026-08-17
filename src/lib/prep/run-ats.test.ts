import { describe, it, expect, vi } from "vitest";
import { runAtsForSession } from "./run-ats";

const sessao = {
  id: "s1", cv_text: "Analista de RH com 8 anos.", job_description: "Gerente de RH.",
  job_title: "Gerente de RH", company_name: "Acme",
};
const analise = {
  score: 70,
  title_match: { cv_title: "a", jd_title: "b", match_score: 40 },
  keyword_analysis: { critical: [], high: [], medium: [] },
  top_fixes: [],
  overall_assessment: "Avaliação suficientemente longa pra passar no schema Zod.",
};

describe("runAtsForSession", () => {
  it("grava a análise e marca complete", async () => {
    const update = vi.fn(async (_id: string, _updates: Record<string, unknown>) => ({
      error: null,
    }));
    await runAtsForSession("s1", {
      loadSession: async () => sessao,
      analyze: async () => analise as never,
      updateSession: update,
    });
    expect(update.mock.calls.at(-1)?.[1]).toMatchObject({ ats_status: "complete" });
  });

  it("marca failed com mensagem PT-BR quando a IA falha", async () => {
    const update = vi.fn(async (_id: string, _updates: Record<string, unknown>) => ({
      error: null,
    }));
    await runAtsForSession("s1", {
      loadSession: async () => sessao,
      analyze: async () => { throw new Error("503"); },
      updateSession: update,
    });
    const ultimo = update.mock.calls.at(-1)?.[1] as { ats_status: string; ats_error_message: string };
    expect(ultimo.ats_status).toBe("failed");
    expect(ultimo.ats_error_message).toMatch(/[çãáéí]/);
  });

  it("não lança quando a sessão não existe", async () => {
    await expect(
      runAtsForSession("inexistente", {
        loadSession: async () => null,
        analyze: vi.fn(),
        updateSession: vi.fn(async () => ({ error: null })),
      }),
    ).resolves.toBeUndefined();
  });
});
