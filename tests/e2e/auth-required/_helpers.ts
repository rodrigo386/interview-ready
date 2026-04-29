import { expect, type Page } from "@playwright/test";

const PASSWORD = "testpassword123";
const TEST_CPF = "12345678909";

/**
 * Generate a unique e2e-only email. Format matches the allowlist in
 * /api/test/confirm-user (only e2e-*@example.com is accepted).
 */
export function uniqueE2EEmail(prefix = "e2e"): string {
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rnd}@example.com`;
}

/**
 * Sign up a fresh user end-to-end. Handles both staging configurations:
 *
 * - Staging with `Confirm email` OFF: Supabase returns a session; signup
 *   action redirects to /dashboard directly.
 * - Staging with `Confirm email` ON: signup returns pendingConfirmation,
 *   page renders a "verifique seu e-mail" message. The helper then calls
 *   the test bypass endpoint (gated by E2E_BYPASS_SECRET) to confirm the
 *   user programmatically, then signs in via the login form.
 *
 * Returns the email used so callers can clean up.
 */
export async function signUpAndLand(
  page: Page,
  fullName = "E2E Tester",
  emailPrefix = "e2e",
): Promise<string> {
  const email = uniqueE2EEmail(emailPrefix);

  await page.goto("/signup");
  await page.getByLabel("Nome completo").fill(fullName);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/CPF/i).fill(TEST_CPF);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();

  // Race: dashboard OR pendingConfirmation message. Whichever lands first wins.
  const result = await Promise.race([
    page
      .waitForURL("**/dashboard", { timeout: 8_000 })
      .then(() => "dashboard" as const)
      .catch(() => null),
    page
      .getByText(/verifique seu e-?mail|confirme seu e-?mail/i)
      .first()
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => "pending" as const)
      .catch(() => null),
  ]);

  if (result === "dashboard") {
    return email;
  }
  if (result !== "pending") {
    throw new Error(
      `Signup of ${email} did not land on /dashboard nor show pendingConfirmation within 8s.`,
    );
  }

  // Confirm email via bypass endpoint, then sign in via UI.
  const secret = process.env.E2E_BYPASS_SECRET;
  if (!secret) {
    throw new Error(
      "Signup hit pendingConfirmation but E2E_BYPASS_SECRET is not set — cannot complete login flow.",
    );
  }
  const confirmRes = await page.request.post("/api/test/confirm-user", {
    headers: { "x-e2e-secret": secret, "content-type": "application/json" },
    data: { email },
  });
  if (!confirmRes.ok()) {
    throw new Error(
      `confirm-user bypass failed: ${confirmRes.status()} ${await confirmRes.text()}`,
    );
  }

  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Prepare sua primeira vaga|Seus preps/i })).toBeVisible();
  return email;
}
