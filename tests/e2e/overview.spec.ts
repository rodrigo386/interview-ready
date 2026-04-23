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

test("Visão geral é a tela inicial com JourneyArc + ContinueCard", async ({
  page,
}) => {
  await signupAndCreatePrep(page);

  // Landing: hero com caption "Prep para" + h1 do company
  await expect(page.getByText("Prep para", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "Hexion" }),
  ).toBeVisible();

  // JourneyArc visível
  const journey = page.getByRole("navigation", { name: /Jornada do prep/i });
  await expect(journey).toBeVisible();

  // Nós da jornada presentes (como links)
  await expect(
    journey.getByRole("link", { name: /Visão geral/i }),
  ).toBeVisible();
  await expect(
    journey.getByRole("link", { name: /Sobre a empresa/i }),
  ).toBeVisible();
  await expect(
    journey.getByRole("link", { name: /Compatibilidade ATS/i }),
  ).toBeVisible();

  // ContinueCard presente — com intel ready e ATS pending no MOCK, próxima parada é "Cheque seu ATS"
  await expect(page.getByText(/Sua próxima parada/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Cheque seu ATS/i }),
  ).toBeVisible();

  // Clicar CTA do ContinueCard navega pro ATS
  await page.getByRole("link", { name: /Rodar análise ATS/i }).click();
  await expect(
    page.getByRole("heading", { name: /Cheque sua compatibilidade com ATS/i }),
  ).toBeVisible();

  // Na seção interna o SectionTabs aparece
  const tabs = page.getByRole("navigation", { name: /Seções do prep/i });
  await expect(tabs).toBeVisible();

  // Voltar à Visão geral via breadcrumb
  await page
    .getByRole("link", { name: /← Visão geral · Hexion/i })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Hexion" }),
  ).toBeVisible();

  // Deep-link ?section=overview continua válido
  const url = new URL(page.url());
  url.searchParams.set("section", "overview");
  await page.goto(url.toString());
  await expect(
    page.getByRole("heading", { level: 1, name: "Hexion" }),
  ).toBeVisible();
});
