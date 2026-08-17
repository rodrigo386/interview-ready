import { describe, it, expect } from "vitest";
import { buildKpis, type OverviewRpc, type AnonFunnel } from "./metrics";

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

  describe("separação entre produto grátis e pago", () => {
    it("não chama de 'prep gerada' o que é análise ATS grátis", () => {
      // `preps24h` conta linhas de prep_sessions, e toda análise ATS cria
      // uma. O rótulo antigo somava grátis com pago no mesmo card.
      const ls = labels(overview({ preps24h: 40 }));
      expect(ls).toContain("Análises ATS logadas 24h");
      expect(ls.join(" ")).not.toMatch(/preps geradas/i);
    });

    it("dá card próprio à preparação paga entregue", () => {
      const kpi = buildKpis(overview({ successPreps30d: 6 })).find(
        (k) => k.label === "Preparações entregues 30d",
      );
      expect(kpi?.value).toBe("6");
    });

    it("distingue os dois números quando volume grátis e pago divergem", () => {
      // O cenário que motivou a mudança: muita análise, pouca conversão.
      const kpis = buildKpis(overview({ preps24h: 100, successPreps30d: 3 }));
      const gratis = kpis.find((k) => k.label === "Análises ATS logadas 24h");
      const pago = kpis.find((k) => k.label === "Preparações entregues 30d");
      expect(gratis?.value).toBe("100");
      expect(pago?.value).toBe("3");
    });
  });

  describe("funil da ferramenta anônima", () => {
    const funnel = (patch: Partial<AnonFunnel> = {}): AnonFunnel => ({
      last24h: 0,
      last7d: 0,
      last30d: 0,
      claimed30d: 0,
      failed30d: 0,
      ...patch,
    });

    it("some inteiro quando a tabela não está disponível", () => {
      // getAnonFunnel devolve null se a 0023 não foi aplicada — o /admin não
      // pode quebrar nem mostrar zeros que parecem dado real.
      const ls = labels(overview()).join(" ");
      expect(ls).not.toMatch(/anônim/i);
    });

    it("mostra volume e taxa de conversão em conta", () => {
      const kpis = buildKpis(
        overview(),
        funnel({ last24h: 9, last7d: 40, last30d: 200, claimed30d: 50 }),
      );
      expect(kpis.find((k) => k.label === "Análises anônimas 24h")?.value).toBe("9");
      const conv = kpis.find((k) =>
        k.label.startsWith("Anônimas viradas em conta"),
      );
      expect(conv?.value).toBe("25%");
      expect(conv?.hint).toBe("50 de 200 reivindicadas");
    });

    it("não divide por zero num período sem nenhuma análise", () => {
      const conv = buildKpis(overview(), funnel()).find((k) =>
        k.label.startsWith("Anônimas viradas em conta"),
      );
      expect(conv?.value).toBe("0%");
    });

    it("só mostra falhas quando existem — zero não é alarme", () => {
      expect(labels(overview()).join(" ")).not.toMatch(/anônimas falhadas/i);
      const kpi = buildKpis(overview(), funnel({ failed30d: 4 })).find((k) =>
        k.label.startsWith("Análises anônimas falhadas"),
      );
      expect(kpi?.value).toBe("4");
    });
  });
});
