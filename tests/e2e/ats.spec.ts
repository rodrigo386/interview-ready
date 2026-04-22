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
  await page.getByLabel("Full name").fill("E2E ATS Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.getByRole("link", { name: /new prep/i }).first().click();
  await page.waitForURL("**/prep/new");
  await page.getByLabel("Company").fill("Hexion");
  await page.getByLabel("Role").fill("Senior Director, AI Procurement");
  await page.getByRole("button", { name: /paste text instead/i }).click();
  await page.getByLabel("Paste your CV text").fill(CV_TEXT);
  await page.getByLabel("Job Description (paste text)").fill(JD_TEXT);
  await page.getByRole("button", { name: /generate prep guide/i }).click();
  await page.waitForURL("**/prep/**", { timeout: 20_000 });

  // Wait for prep guide to fully load (skeleton resolves once generation completes)
  await expect(page.getByRole("heading", { name: /Prep for Hexion/i })).toBeVisible({ timeout: 30_000 });

  // Should now see ATS CTA banner
  await expect(page.getByRole("heading", { name: /Check your ATS match/i })).toBeVisible();

  // Click Run ATS Match
  await page.getByRole("button", { name: /run ats match/i }).click();

  // After revalidation, score card should appear
  await expect(page.getByText(/ATS Match Score/i)).toBeVisible({ timeout: 20_000 });
  // MOCK_ATS has score 73
  await expect(page.getByText(/73/).first()).toBeVisible();
  // Top fix #1 is "Missing: agentic AI"
  await expect(page.getByText(/Missing: agentic AI/i)).toBeVisible();

  // Dashboard shows ATS 73% badge now that analysis is complete
  await page.goto("/dashboard");
  await expect(page.getByText(/ATS 73%/i)).toBeVisible();

  // Back to prep, re-run should produce a fresh complete analysis (in MOCK mode
  // the Server Action runs synchronously so the skeleton transition is too fast
  // to reliably observe; we just assert the button works and the card re-renders).
  await page.getByRole("link", { name: /Hexion/i }).first().click();
  await page.waitForURL("**/prep/**");
  await expect(page.getByText(/ATS Match Score/i)).toBeVisible();
  await page.getByRole("button", { name: /Re-run/i }).click();
  await expect(page.getByText(/ATS Match Score/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Missing: agentic AI/i)).toBeVisible();
});
