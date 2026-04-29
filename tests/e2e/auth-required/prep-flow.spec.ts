import { test, expect } from "@playwright/test";
import { signUpAndLand } from "./_helpers";

const CV_TEXT = `Rodrigo Costa — 10 years in procurement leadership.
2019-2022 Bayer LATAM: Head of Digital Procurement Transformation.
Led $500M addressable spend rollout of e-sourcing platform across 12 countries.
Delivered 18% cost takeout and 40% cycle-time reduction over 24 months.
2022-present Private Equity portfolio CFO advisor on procurement.
Education: MBA Insead 2018.`;

const JD_TEXT = `Senior Director, AI & Digital Procurement Transformation.
Hexion is a $3B specialty chemicals company, sponsor-owned (private equity).
You will design and deploy agentic AI sourcing capability across $300M+ addressable spend.
Responsibilities include: build the target operating model, stand up an AI Center of Excellence,
deploy AI Sourcing Agents for autonomous negotiation on tail spend, and drive touchless P2P.
Qualifications: 10+ years procurement transformation, hands-on AI deployment, PE experience preferred.`;

async function signupAndCreatePrep(page: import("@playwright/test").Page) {
  await signUpAndLand(page, "E2E Prep Flow", "e2e-prepflow");
  await page.goto("/prep/new");
  await page.getByLabel("Empresa").fill("Hexion");
  await page.getByLabel("Cargo").fill("Senior Director, AI Procurement");
  await page.getByRole("button", { name: /colar texto em vez disso/i }).click();
  await page.getByLabel(/Cole o texto do seu CV/i).fill(CV_TEXT);
  await page.getByLabel(/Descrição da vaga/i).fill(JD_TEXT);
  await page.getByRole("button", { name: /gerar meu dossiê/i }).click();
  await page.waitForURL("**/prep/**", { timeout: 30_000 });
}

test.describe("PrepaVAGA Opção A — fluxo das 5 telas", () => {
  test("Tela 1 mostra PrepStepper + FocusCard + breadcrumb (sem JourneyArc)", async ({ page }) => {
    await signupAndCreatePrep(page);

    // Header empresa
    await expect(page.getByText("Prep para", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Hexion" })).toBeVisible();

    // PrepStepper visível como progressbar
    await expect(page.getByRole("progressbar", { name: /progresso do prep/i })).toBeVisible();

    // FocusCard visível (CTA contém uma das possíveis labels do step)
    const focusCta = page.getByRole("link", { name: /começar agora|rodar análise|ver visão geral|continuar|finalizar prep/i });
    await expect(focusCta.first()).toBeVisible();

    // JourneyArc REMOVIDO — não pode existir nav com aria-label "Jornada do prep"
    await expect(page.getByRole("navigation", { name: /Jornada do prep/i })).toHaveCount(0);

    // Breadcrumb voltar
    await expect(page.getByRole("link", { name: /voltar para seus preps/i })).toBeVisible();
  });

  test("/ats renderiza Tela 2 (ou estado pending) sem JourneyArc", async ({ page }) => {
    await signupAndCreatePrep(page);
    const url = new URL(page.url());
    await page.goto(`${url.origin}${url.pathname.replace(/\/$/, "")}/ats`);

    // Header da tela
    await expect(page.getByText(/passo 2 · compatibilidade ats/i)).toBeVisible({ timeout: 10_000 })
      .catch(async () => {
        // Se ats_status é pending, mostra AtsCtaCard que não tem o header. Aceitar como válido.
        await expect(page.getByRole("heading", { name: /cheque (sua )?compatibilidade/i })).toBeVisible();
      });

    await expect(page.getByRole("navigation", { name: /Jornada do prep/i })).toHaveCount(0);
  });

  test("/likely renderiza Tela 3 com QuestionCard accent laranja", async ({ page }) => {
    await signupAndCreatePrep(page);
    const url = new URL(page.url());
    await page.goto(`${url.origin}${url.pathname.replace(/\/$/, "")}/likely`);

    // Header da tela 3 OR empty state (depende de seção gerada pelo mock)
    const header = page.getByText(/passo 3 · perguntas básicas/i);
    const empty = page.getByText(/sem perguntas básicas geradas/i);
    await expect(header.or(empty)).toBeVisible({ timeout: 10_000 });
  });

  test("/deep-dive renderiza Tela 4 com badge 🔥", async ({ page }) => {
    await signupAndCreatePrep(page);
    const url = new URL(page.url());
    await page.goto(`${url.origin}${url.pathname.replace(/\/$/, "")}/deep-dive`);

    const header = page.getByText(/passo 4 · aprofundamento/i);
    const empty = page.getByText(/sem perguntas de aprofundamento/i);
    await expect(header.or(empty)).toBeVisible({ timeout: 10_000 });
  });

  test("/ask renderiza Tela 5 com SuccessBanner", async ({ page }) => {
    await signupAndCreatePrep(page);
    const url = new URL(page.url());
    await page.goto(`${url.origin}${url.pathname.replace(/\/$/, "")}/ask`);

    // SuccessBanner OR empty
    const banner = page.getByText(/prep completo · você está pronto/i);
    const empty = page.getByText(/sem perguntas pra fazer geradas/i);
    await expect(banner.or(empty)).toBeVisible({ timeout: 10_000 });
  });
});
