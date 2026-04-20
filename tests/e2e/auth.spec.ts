import { test, expect } from "@playwright/test";

test("signup with email lands on dashboard empty state", async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email").fill(uniqueEmail);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Create your first prep" })).toBeVisible();
});
