import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);

// Must match E2E_UA_MARKER in src/lib/analytics/page-views.ts. Without it the
// suite's Desktop Chrome UA is indistinguishable from a real visitor and the
// smoke tests get counted as traffic in /admin.
const E2E_UA_MARKER = "PrepaVagaE2E";

// O `userAgent` do `use` GLOBAL não vale pros projetos: `use` de projeto
// sobrescreve o global, e `...devices["Desktop Chrome"]` traz o user-agent
// padrão — que apagava o marcador. Foi assim de 15/08 a 09/10/2026: 548 visitas
// do CI entraram como tráfego real (70 execuções do CI, 7 páginas cada). O
// marcador tem que ir no `use` DE CADA PROJETO, depois do spread. Há um teste
// (src/lib/analytics/e2e-marker.test.ts) que falha se um projeto novo esquecer.
const E2E_UA = `${devices["Desktop Chrome"].userAgent} ${E2E_UA_MARKER}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    userAgent: E2E_UA,
  },
  projects: [
    {
      name: "smoke",
      testMatch: /smoke\/.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], userAgent: E2E_UA },
    },
    {
      name: "auth",
      testMatch: /auth-required\/.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], userAgent: E2E_UA },
    },
  ],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    port: PORT,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      MOCK_ANTHROPIC: "1",
    },
  },
});
