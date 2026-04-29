import { test, expect } from "@playwright/test";
import { signUpAndLand } from "./_helpers";

test("signup with email lands on dashboard empty state", async ({ page }) => {
  await signUpAndLand(page);
  await expect(page.getByRole("heading", { name: /Prepare sua primeira vaga/i })).toBeVisible();
});
