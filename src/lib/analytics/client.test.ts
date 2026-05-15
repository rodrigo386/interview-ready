import { describe, it, expect, vi, beforeEach } from "vitest";

describe("analytics client", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear env between tests so isAnalyticsEnabled reflects the per-test state.
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  it("is disabled when NEXT_PUBLIC_POSTHOG_KEY is unset", async () => {
    const { isAnalyticsEnabled, track } = await import("./client");
    expect(isAnalyticsEnabled()).toBe(false);
    // track() must be a safe no-op when disabled — no throw, no network.
    expect(() =>
      track("landing_view", { path: "/" }),
    ).not.toThrow();
  });

  it("reports enabled once the env var is present", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    const { isAnalyticsEnabled } = await import("./client");
    expect(isAnalyticsEnabled()).toBe(true);
  });
});
