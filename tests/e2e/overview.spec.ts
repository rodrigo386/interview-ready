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

async function signupAndCreatePrep(page: import("@playwright/test").Page) {
  const email = `e2e-overview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Nome completo").fill("E2E Overview Tester");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("testpassword123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.goto("/prep/new");
  await page.getByLabel("Empresa").fill("Hexion");
  await page.getByLabel("Cargo").fill("Senior Director, AI Procurement");
  await page.getByRole("button", { name: /colar texto em vez disso/i }).click();
  await page.getByLabel(/Cole o texto do seu CV/i).fill(CV_TEXT);
  await page.getByLabel(/Descrição da vaga/i).fill(JD_TEXT);
  await page.getByRole("button", { name: /gerar meu dossiê/i }).click();
  await page.waitForURL("**/prep/**", { timeout: 30_000 });
}

test("Visão geral é a tela inicial com status, cards e sidebar", async ({ page }) => {
  await signupAndCreatePrep(page);

  // Landing: overview com caption "Prep para" + h1 do company
  await expect(page.getByText("Prep para", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { level: 1, name: "Hexion" })).toBeVisible();

  // Status grid
  await expect(
    page.getByRole("heading", { name: /Status do seu prep/i }),
  ).toBeVisible();
  await expect(page.getByText(/Guia de perguntas/i)).toBeVisible();
  await expect(page.getByText(/Sobre a empresa/i).first()).toBeVisible();
  await expect(page.getByText(/Compatibilidade ATS/i).first()).toBeVisible();

  // Cards "Comece por aqui"
  await expect(
    page.getByRole("heading", { name: /Comece por aqui/i }),
  ).toBeVisible();
  await expect(page.getByText(/Conheça a empresa/i)).toBeVisible();
  await expect(page.getByText(/Cheque seu ATS/i)).toBeVisible();

  // Sidebar tem Visão geral, Sobre a empresa, Compatibilidade ATS
  const sidebar = page.getByRole("navigation", { name: /Navegação do prep/i });
  await expect(sidebar.getByRole("link", { name: /Visão geral/i })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: /Sobre a empresa/i })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: /Compatibilidade ATS/i })).toBeVisible();

  // Clicar "Comece por aqui" card 1 → Sobre a empresa
  await page.getByRole("link", { name: /Conheça a empresa/i }).click();
  await expect(page.getByRole("heading", { name: /Sobre a empresa/i })).toBeVisible();

  // Voltar à Visão geral via sidebar
  await sidebar.getByRole("link", { name: /Visão geral/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Hexion" })).toBeVisible();

  // Deep-link ?section=overview
  const url = new URL(page.url());
  url.searchParams.set("section", "overview");
  await page.goto(url.toString());
  await expect(page.getByRole("heading", { level: 1, name: "Hexion" })).toBeVisible();
});
