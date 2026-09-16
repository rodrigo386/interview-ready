import { describe, it, expect, vi } from "vitest";
import {
  buildCheckoutRecoveryEmail,
  sendCheckoutRecovery,
  type PendingPrep,
  type RecoveryDeps,
} from "./checkout-recovery";
import type { AtsAnalysis } from "@/lib/ai/schemas";

const analise: AtsAnalysis = {
  score: 38,
  title_match: { cv_title: "Analista de RH Júnior", jd_title: "Analista Jr", match_score: 67 },
  keyword_analysis: {
    critical: [
      { keyword: "benefícios", found: false },
      { keyword: "legislação", found: false },
      { keyword: "relatórios", found: true },
    ],
    high: [{ keyword: "treinamento", found: false }],
    medium: [],
  },
  top_fixes: [],
  overall_assessment: "Avaliação longa o bastante para o schema.",
};

// O caso real de 14/09.
const prep: PendingPrep = {
  id: "77cf8b6b",
  job_title: "Analista Jr",
  company_name: "a empresa",
  analysis: analise,
};

describe("buildCheckoutRecoveryEmail", () => {
  it("personaliza com cargo, nota e palavras que faltam", () => {
    const e = buildCheckoutRecoveryEmail({ name: "Mirta Silva", prep });
    expect(e.subject).toBe("Seu currículo para Analista Jr ficou pela metade");
    expect(e.html).toContain("Mirta, s");
    expect(e.html).toContain("<strong>38</strong>");
    expect(e.html).toContain("<strong>benefícios</strong>, <strong>legislação</strong> e <strong>treinamento</strong>");
  });

  it("leva direto de volta à análise daquela vaga", () => {
    expect(buildCheckoutRecoveryEmail({ name: null, prep }).url).toMatch(/\/prep\/77cf8b6b\/ats$/);
  });

  it("não mostra placeholder de empresa como se fosse nome", () => {
    const e = buildCheckoutRecoveryEmail({ name: null, prep });
    expect(e.html).not.toContain("<strong>a empresa</strong>");
  });

  it("escapa HTML de cargo e empresa — é texto colado por qualquer pessoa", () => {
    const e = buildCheckoutRecoveryEmail({
      name: null,
      prep: { ...prep, job_title: "<script>x</script>", company_name: 'A"cme<b>' },
    });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html).not.toContain('A"cme<b>');
  });

  it("promete o que os termos garantem, no momento da decisão", () => {
    const e = buildCheckoutRecoveryEmail({ name: null, prep });
    expect(e.html).toMatch(/reembolso em 7 dias/);
    expect(e.html).toMatch(/Asaas/);
  });

  it("sem prep pendente, manda pro dashboard com texto genérico", () => {
    const e = buildCheckoutRecoveryEmail({ name: null, prep: null });
    expect(e.url).toMatch(/\/dashboard$/);
    expect(e.subject).toBe("Seu currículo ficou pela metade");
  });
});

function deps(patch: Partial<RecoveryDeps> = {}): RecoveryDeps {
  return {
    loadProfile: async () => ({ email: "a@b.com", full_name: "Mirta", prep_credits: 0 }),
    paidSince: async () => false,
    loadPendingPrep: async () => prep,
    send: vi.fn(async () => ({ ok: true }) as never),
    ...patch,
  };
}

describe("sendCheckoutRecovery", () => {
  it("manda para quem abandonou e segue sem crédito", async () => {
    const d = deps();
    expect(await sendCheckoutRecovery("u1", "pay_1", d)).toEqual({ sent: true });
    expect(d.send).toHaveBeenCalledOnce();
  });

  it("não manda pra quem já tem crédito — não é mais abandono", async () => {
    const d = deps({
      loadProfile: async () => ({ email: "a@b.com", full_name: null, prep_credits: 1 }),
    });
    expect(await sendCheckoutRecovery("u1", "pay_1", d)).toEqual({ sent: false, reason: "has_credit" });
    expect(d.send).not.toHaveBeenCalled();
  });

  it("não manda pra quem pagou depois (outra aba, PIX tardio)", async () => {
    const d = deps({ paidSince: async () => true });
    expect(await sendCheckoutRecovery("u1", "pay_1", d)).toEqual({ sent: false, reason: "already_paid" });
    expect(d.send).not.toHaveBeenCalled();
  });

  it("nunca lança — roda dentro do webhook", async () => {
    const d = deps({ loadProfile: async () => { throw new Error("db fora"); } });
    await expect(sendCheckoutRecovery("u1", "pay_1", d)).resolves.toEqual({
      sent: false,
      reason: "send_failed",
    });
  });
});
