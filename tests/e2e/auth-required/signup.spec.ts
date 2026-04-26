import { test, expect } from "@playwright/test";

test("signup with email lands on dashboard empty state", async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Criar sua conta" })).toBeVisible();

  await page.getByLabel("Nome completo").fill("E2E Tester");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel(/CPF/i).fill("12345678909");
  await page.getByLabel("Senha").fill("testpassword123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();

  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Prepare sua primeira vaga/i })).toBeVisible();
});
