import { test, expect } from "./_helpers";

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

test("Sobre a empresa tab renders and deep-links", async ({ page, signUp }) => {
  await signUp("E2E Intel Tester", "e2e-intel");

  await page.goto("/prep/new");
  await page.getByLabel("Empresa").fill("Hexion");
  await page.getByLabel("Cargo").fill("Senior Director, AI Procurement");
  await page.getByRole("button", { name: /colar texto em vez disso/i }).click();
  await page.getByLabel(/Cole o texto do seu CV/i).fill(CV_TEXT);
  await page.getByLabel(/Descrição da vaga/i).fill(JD_TEXT);
  await page.getByRole("button", { name: /gerar meu dossiê/i }).click();

  await page.waitForURL("**/prep/**", { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Hexion" })).toBeVisible({
    timeout: 15_000,
  });

  // Link "Sobre a empresa" na sidebar
  const intelLink = page.getByRole("link", { name: /Sobre a empresa/i });
  await expect(intelLink).toBeVisible();
  await intelLink.click();
  await expect(page.getByRole("heading", { name: /Sobre a empresa/i })).toBeVisible();

  // Fixture do mock renderiza os campos-chave
  await expect(page.getByText(/Mock Co is a \$3B specialty chemicals/i)).toBeVisible();
  await expect(page.getByText(/IPO filed March 2026/i)).toBeVisible();
  await expect(page.getByText(/Jane Doe/i)).toBeVisible();
  await expect(page.getByText(/sponsor-owned speed/i)).toBeVisible();
  await expect(
    page.getByText(/How does the IPO timeline affect the procurement/i),
  ).toBeVisible();

  // Deep-link ?section=company-intel continua válido (compat)
  const url = new URL(page.url());
  url.searchParams.set("section", "company-intel");
  await page.goto(url.toString());
  await expect(page.getByRole("heading", { name: /Sobre a empresa/i })).toBeVisible();
});
