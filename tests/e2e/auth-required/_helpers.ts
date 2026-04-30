import { test as base, expect, type Page } from "@playwright/test";

const PASSWORD = "testpassword123";
const TEST_CPF = "12345678909";
// Endereço fixo de teste pra signup E2E (formato válido, não real).
const TEST_ADDRESS = {
  postalCode: "01310100",
  street: "Avenida Paulista",
  number: "1000",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
} as const;

/**
 * Generate a unique e2e-only email. Format matches the allowlist in
 * /api/test/confirm-user and /api/test/delete-user.
 */
export function uniqueE2EEmail(prefix = "e2e"): string {
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rnd}@example.com`;
}

async function signUpAndLandRaw(
  page: Page,
  fullName: string,
  emailPrefix: string,
): Promise<string> {
  const email = uniqueE2EEmail(emailPrefix);

  await page.goto("/signup");
  await page.getByLabel("Nome completo").fill(fullName);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/CPF/i).fill(TEST_CPF);
  await page.getByLabel("CEP").fill(TEST_ADDRESS.postalCode);
  await page.getByLabel("Logradouro").fill(TEST_ADDRESS.street);
  await page.getByLabel("Número", { exact: true }).fill(TEST_ADDRESS.number);
  await page.getByLabel("Bairro").fill(TEST_ADDRESS.district);
  await page.getByLabel("Cidade").fill(TEST_ADDRESS.city);
  await page.getByLabel("UF").fill(TEST_ADDRESS.state);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();

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
  await expect(
    page.getByRole("heading", { name: /Prepare sua primeira vaga|Seus preps/i }),
  ).toBeVisible();
  return email;
}

type SignUpFn = (fullName?: string, emailPrefix?: string) => Promise<string>;

/**
 * Playwright test fixture that creates fresh e2e users on demand AND deletes
 * them automatically when the test ends — even if the test failed or threw.
 * Uses /api/test/delete-user (gated by E2E_BYPASS_SECRET) to drop the user
 * with cascade through profile/preps/cvs/payments.
 *
 * Usage in specs:
 *   import { test, expect } from "./_helpers";
 *   test("foo", async ({ page, signUp }) => {
 *     const email = await signUp("E2E Foo Tester", "e2e-foo");
 *     // test body — cleanup happens automatically when fixture goes out of scope
 *   });
 *
 * Cleanup happens regardless of test outcome. Failures during cleanup are
 * logged but never fail the test (test outcome shouldn't depend on cleanup).
 */
export const test = base.extend<{ signUp: SignUpFn }>({
  signUp: async ({ page, request }, use) => {
    const created: string[] = [];
    const signUp: SignUpFn = async (
      fullName = "E2E Tester",
      emailPrefix = "e2e",
    ) => {
      const email = await signUpAndLandRaw(page, fullName, emailPrefix);
      created.push(email);
      return email;
    };

    await use(signUp);

    // Cleanup phase — runs even if the test failed.
    const secret = process.env.E2E_BYPASS_SECRET;
    if (!secret) {
      if (created.length > 0) {
        console.warn(
          `[e2e cleanup] ${created.length} test users not cleaned up — E2E_BYPASS_SECRET not set.`,
        );
      }
      return;
    }
    for (const email of created) {
      try {
        const res = await request.post("/api/test/delete-user", {
          headers: { "x-e2e-secret": secret, "content-type": "application/json" },
          data: { email },
        });
        if (!res.ok()) {
          console.warn(
            `[e2e cleanup] failed to delete ${email}: ${res.status()} ${await res
              .text()
              .catch(() => "")}`,
          );
        }
      } catch (err) {
        console.warn(`[e2e cleanup] error deleting ${email}:`, err);
      }
    }
  },
});

export { expect };

/**
 * @deprecated Use the `signUp` fixture from this module's `test` instead — it
 * registers automatic cleanup. This standalone helper does NOT clean up and
 * leaks test users.
 */
export async function signUpAndLand(
  page: Page,
  fullName = "E2E Tester",
  emailPrefix = "e2e",
): Promise<string> {
  return signUpAndLandRaw(page, fullName, emailPrefix);
}
