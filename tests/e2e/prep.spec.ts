import { test, expect } from "@playwright/test";

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

test("signup + create prep + view prep guide", async ({ page }) => {
  const email = `e2e-prep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Nome completo").fill("E2E Prep Tester");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("testpassword123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.getByRole("link", { name: /primeiro prep|novo prep/i }).first().click();
  await page.waitForURL("**/prep/new");
  await expect(page.getByRole("heading", { name: /novo prep/i })).toBeVisible();

  await page.getByLabel("Empresa").fill("Hexion");
  await page.getByLabel("Cargo").fill("Senior Director, AI Procurement");
  await page.getByRole("button", { name: /colar texto em vez disso/i }).click();
  await page.getByLabel(/Cole o texto do seu CV/i).fill(CV_TEXT);
  await page.getByLabel(/Descrição da vaga/i).fill(JD_TEXT);

  await page.getByRole("button", { name: /gerar meu dossiê/i }).click();

  await page.waitForURL("**/prep/**", { timeout: 20_000 });

  await expect(page.getByRole("heading", { name: /Prep para Hexion/i })).toBeVisible({
    timeout: 10_000,
  });
  // Com Company Intel presente, "Visão geral" é a aba default — clica em "Likely Questions" (título vindo da IA).
  await page.getByRole("link", { name: /Likely Questions/i }).click();

  await page
    .getByRole("button", { name: /why are you interested in this role/i })
    .click();
  await expect(page.getByText("Pontos-chave")).toBeVisible();
  await expect(page.getByText("Resposta modelo")).toBeVisible();
});
