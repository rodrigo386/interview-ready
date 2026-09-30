import { describe, expect, it } from "vitest";
import { salaryBenchmarkSchema } from "./schemas";
import { normalizeSeniority } from "./salary-seniority";

describe("normalizeSeniority", () => {
  it.each([
    ["sênior", "senior"],
    ["Sênior", "senior"],
    ["liderança", "lideranca"],
    ["Estágio", "estagio"],
    ["Sr", "senior"],
    ["gerente", "lideranca"],
    ["pleno", "pleno"],
    ["nao identificado", "nao_identificado"],
    ["algo inesperado", "nao_identificado"],
  ])("%s → %s", (entrada, saida) => {
    expect(normalizeSeniority(entrada)).toBe(saida);
  });

  it("não mexe em não-string", () => {
    expect(normalizeSeniority(undefined)).toBeUndefined();
  });

  it("a resposta real que falhou em prod passa no schema depois de normalizar", () => {
    const parsed = salaryBenchmarkSchema.safeParse({
      seniority: normalizeSeniority("sênior"),
      min_brl: 9000,
      median_brl: 14000,
      max_brl: 22000,
      currency: "BRL",
      region_hint: "Brasil (média nacional)",
      notes: "Rede de grande porte; remuneração com base mais variável.",
      confidence: "medium",
    });
    expect(parsed.success).toBe(true);
  });
});
