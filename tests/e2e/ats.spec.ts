import { test, expect } from "@playwright/test";

const CV_TEXT = `Rodrigo Costa — 10 years procurement leadership.
2019-2022 Bayer LATAM: Head of Digital Procurement Transformation.
Led $500M addressable spend, 18% cost takeout, 40% cycle-time reduction.
2022-present PE portfolio advisor on procurement digitization.
MBA Insead 2018.`;

const JD_TEXT = `Senior Director, AI & Digital Procurement Transformation.
Hexion $3B specialty chemicals, PE-backed.
Deploy agentic AI sourcing capability across $300M+ addressable spend.
Build target operating model, stand up AI Center of Excellence,
deploy AI Sourcing Agents for autonomous negotiation on tail spend, drive touchless P2P.
10+ years procurement transformation required, hands-on AI deployment, PE experience preferred.`;

test("run ATS match shows score and top fixes", async ({ page }) => {
  const email = `e2e-ats-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  // Signup + create prep (reuse MOCK path)
  await page.goto("/signup");
  await page.getByLabel("Nome completo").fill("E2E ATS Tester");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("testpassword123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.getByRole("link", { name: /primeiro prep|novo prep/i }).first().click();
  await page.waitForURL("**/prep/new");
  await page.getByLabel("Empresa").fill("Hexion");
  await page.getByLabel("Cargo").fill("Senior Director, AI Procurement");
  await page.getByRole("button", { name: /colar texto em vez disso/i }).click();
  await page.getByLabel(/Cole o texto do seu CV/i).fill(CV_TEXT);
  await page.getByLabel(/Descrição da vaga/i).fill(JD_TEXT);
  await page.getByRole("button", { name: /gerar meu dossiê/i }).click();
  await page.waitForURL("**/prep/**", { timeout: 20_000 });

  // Landing cai na Visão geral
  await expect(page.getByRole("heading", { level: 1, name: "Hexion" })).toBeVisible({
    timeout: 30_000,
  });

  // Navega para a seção ATS via sidebar
  await page.getByRole("link", { name: /Compatibilidade ATS/i }).first().click();

  // CTA do ATS visível
  await expect(
    page.getByRole("heading", { name: /Cheque sua compatibilidade com ATS/i }),
  ).toBeVisible();

  // Rodar compatibilidade ATS
  await page.getByRole("button", { name: /rodar compatibilidade ats/i }).click();

  // Score card renderiza (MOCK_ATS score = 73)
  await expect(page.getByText(/73 \/ 100/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /Principais ajustes/i })).toBeVisible();
  await expect(page.getByText(/Missing: agentic AI/i)).toBeVisible();

  // Dashboard mostra badge ATS 73%
  await page.goto("/dashboard");
  await expect(page.getByText(/ATS 73%/i)).toBeVisible();

  // Voltar ao prep, ir direto pro ATS via deep-link
  await page.getByRole("link", { name: /Hexion/i }).first().click();
  await page.waitForURL("**/prep/**");
  await page.getByRole("link", { name: /Compatibilidade ATS/i }).first().click();
  await expect(page.getByText(/73 \/ 100/i)).toBeVisible();

  // Re-rodar
  await page.getByRole("button", { name: /Rerodar/i }).first().click();
  await expect(page.getByText(/73 \/ 100/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Missing: agentic AI/i)).toBeVisible();

  // CTA de reescrita aparece após ATS completar
  await expect(
    page.getByRole("button", { name: /Gerar CV otimizado para ATS/i }),
  ).toBeVisible();

  // Gerar reescrita → view renderiza com MOCK_CV_REWRITE
  await page.getByRole("button", { name: /Gerar CV otimizado para ATS/i }).click();
  await expect(page.getByText(/Resumo das mudanças/i)).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/Upgraded 'digital tools' to 'agentic AI'/i),
  ).toBeVisible();
  await expect(page.getByText(/touchless P2P/i).first()).toBeVisible();

  // Copiar markdown visível
  await expect(page.getByRole("button", { name: /Copiar markdown/i })).toBeVisible();

  // Download .docx aponta para rota correta e responde 200
  const href = await page
    .getByRole("link", { name: /Baixar \.docx/i })
    .getAttribute("href");
  expect(href).toMatch(/\/prep\/.+\/cv-rewrite\.docx$/);
  const docxUrl = new URL(href!, page.url()).toString();
  const res = await page.request.get(docxUrl);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("wordprocessingml");
});
