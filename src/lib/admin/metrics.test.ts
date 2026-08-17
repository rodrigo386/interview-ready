import { describe, it, expect } from "vitest";
import { buildKpis, type OverviewRpc } from "./metrics";

/**
 * Base "conta zerada": todo teste parte daqui e sobrescreve só o que importa
 * pro caso, pra ficar óbvio qual campo está sob teste.
 */
function overview(patch: Partial<OverviewRpc> = {}): OverviewRpc {
  return {
    totalUsers: 0,
    signups24h: 0,
    signups7d: 0,
    signups30d: 0,
    proActive: 0,
    overdue: 0,
    totalCredits: 0,
    totalPreps: 0,
    preps24h: 0,
    preps7d: 0,
    preps30d: 0,
    failedPreps7d: 0,
    successPreps30d: 0,
    activeUsers7d: 0,
    activeUsers30d: 0,
    activated30d: 0,
    revenueCents30d: 0,
    pendingPayments: 0,
    ...patch,
  };
}

const labels = (o: OverviewRpc) => buildKpis(o).map((k) => k.label);

describe("buildKpis", () => {
  it("não expõe MRR em nenhum cenário", () => {
    // O card antigo lia `proActive`/`overdue` — os dois campos que ainda
    // existem no RPC. Se alguém reintroduzir o cálculo, é aqui que quebra.
    for (const o of [
      overview(),
      overview({ proActive: 12, overdue: 3 }),
      overview({ revenueCents30d: 990_00 }),
    ]) {
      expect(labels(o).join(" ")).not.toMatch(/mrr/i);
    }
  });

  it("omite o card de Pro legado quando não há nenhum", () => {
    expect(labels(overview())).not.toContain(
      "Pro legado (não destrava nada)",
    );
  });

  it("mostra o Pro legado enquanto existir, dizendo que não vale cota", () => {
    const kpi = buildKpis(overview({ proActive: 1 })).find((k) =>
      k.label.startsWith("Pro legado"),
    );
    expect(kpi?.value).toBe("1");
    expect(kpi?.hint).toBe("Sem efeito na cota");
  });

  it("conta o overdue no hint, não no valor — overdue não é receita", () => {
    const kpi = buildKpis(overview({ proActive: 2, overdue: 5 })).find((k) =>
      k.label.startsWith("Pro legado"),
    );
    expect(kpi?.value).toBe("2");
    expect(kpi?.hint).toContain("+5 em atraso");
  });

  it("aparece mesmo com proActive zerado se houver overdue", () => {
    // Zero ativos e alguém em atraso ainda é estado legado a resolver;
    // sumir com o card esconderia isso.
    expect(labels(overview({ overdue: 1 }))).toContain(
      "Pro legado (não destrava nada)",
    );
  });

  it("descreve créditos como obrigação, não como saldo de cortesia", () => {
    const kpi = buildKpis(overview({ totalCredits: 7 })).find(
      (k) => k.label === "Créditos não consumidos",
    );
    expect(kpi?.value).toBe("7");
    expect(kpi?.hint).toBe("Preparações pagas e ainda não entregues");
  });

  it("formata a receita 30d em reais", () => {
    const kpi = buildKpis(overview({ revenueCents30d: 12_345 })).find((k) =>
      k.label.startsWith("Receita últimos 30d"),
    );
    expect(kpi?.value).toBe("123,45");
  });

  it("não divide por zero quando não houve cadastro no período", () => {
    const kpi = buildKpis(overview({ activated30d: 0, signups30d: 0 })).find(
      (k) => k.label === "Ativação 30d",
    );
    expect(kpi?.value).toBe("0%");
  });

  it("calcula a taxa de ativação sobre os cadastros do período", () => {
    const kpi = buildKpis(overview({ activated30d: 3, signups30d: 8 })).find(
      (k) => k.label === "Ativação 30d",
    );
    expect(kpi?.value).toBe("38%");
  });
});
