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
  await page.getByLabel("Full name").fill("E2E Prep Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.getByRole("link", { name: /new prep/i }).first().click();
  await page.waitForURL("**/prep/new");
  await expect(page.getByRole("heading", { name: /create a prep guide/i })).toBeVisible();

  await page.getByLabel("Company").fill("Hexion");
  await page.getByLabel("Role").fill("Senior Director, AI Procurement");
  await page.getByRole("button", { name: /paste text instead/i }).click();
  await page.getByLabel("Paste your CV text").fill(CV_TEXT);
  await page.getByLabel("Job Description (paste text)").fill(JD_TEXT);

  await page.getByRole("button", { name: /generate prep guide/i }).click();

  await page.waitForURL("**/prep/**", { timeout: 20_000 });

  // "Prep for Hexion" comes from meta.company written by runGeneration (session.company_name).
  await expect(page.getByRole("heading", { name: /Prep for Hexion/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Likely Questions").first()).toBeVisible();

  await page
    .getByRole("button", { name: /why are you interested in this role/i })
    .click();
  await expect(page.getByText("Key points")).toBeVisible();
  await expect(page.getByText("Sample answer")).toBeVisible();
});
