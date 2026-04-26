import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);

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
  },
  projects: [
    {
      name: "smoke",
      testMatch: /smoke\/.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "auth",
      testMatch: /auth-required\/.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
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
