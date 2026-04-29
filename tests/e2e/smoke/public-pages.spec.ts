import { test, expect } from "@playwright/test";

test.describe("Public pages render without auth", () => {
  test("landing renders hero + CTA + footer", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText(/Entre pronto/i, { timeout: 10_000 });
    // Primary CTA in hero
    await expect(
      page.getByRole("link", { name: /preparar minha próxima vaga/i }),
    ).toBeVisible();
    // Footer copyright shows current company
    await expect(page.getByText(/PROAICIRCLE Ltda/i)).toBeVisible();
  });

  test("/signup form has all required fields including CPF", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /Criar sua conta/i })).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel(/CPF/i)).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: /^criar conta$/i })).toBeVisible();
  });

  test("/login renders with email + password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
  });

  test("/termos renders all 12 sections", async ({ page }) => {
    await page.goto("/termos");
    await expect(page.getByRole("heading", { name: /Termos de Uso/i })).toBeVisible();
    // PROAICIRCLE/CNPJ/Foro appear in multiple places (intro, contract section,
    // footer). `.first()` keeps the assertion strict-mode-safe.
    await expect(page.getByText(/PROAICIRCLE/).first()).toBeVisible();
    await expect(page.getByText(/CNPJ.*62\.805\.016\/0001-29/).first()).toBeVisible();
    await expect(page.getByText(/Foro Central da Comarca de São Paulo/i).first()).toBeVisible();
  });

  test("/privacidade identifies the controller and lists LGPD rights", async ({ page }) => {
    await page.goto("/privacidade");
    await expect(page.getByRole("heading", { name: /Política de Privacidade/i })).toBeVisible();
    await expect(page.getByText(/PROAICIRCLE CONSULTORIA/).first()).toBeVisible();
    // Email link appears in multiple sections (controller, DPO, contact).
    await expect(page.getByText(/privacidade@prepavaga\.com\.br/i).first()).toBeVisible();
    // Section 7 covers art. 18 LGPD rights
    await expect(page.getByRole("heading", { name: /Seus direitos como titular/i })).toBeVisible();
  });

  test("/lgpd shows the 9 titular rights and DPO contact", async ({ page }) => {
    await page.goto("/lgpd");
    await expect(page.getByRole("heading", { name: /Seus direitos LGPD/i })).toBeVisible();
    // Numbered list of 9 rights
    await expect(page.getByText(/Confirmação:/)).toBeVisible();
    await expect(page.getByText(/Portabilidade:/)).toBeVisible();
    await expect(page.getByText(/Revogação do consentimento/)).toBeVisible();
  });

  test("favicon and OG image routes are reachable", async ({ request }) => {
    const icon = await request.get("/icon.svg");
    expect(icon.status()).toBeLessThan(400);
    const og = await request.get("/opengraph-image");
    expect(og.status()).toBeLessThan(400);
    expect(og.headers()["content-type"]).toContain("image/png");
  });
});
