import { test, expect } from "./_helpers";

test("signup with email lands on dashboard empty state", async ({ page, signUp }) => {
  await signUp();
  await expect(page.getByRole("heading", { name: /Prepare sua primeira vaga/i })).toBeVisible();
});
