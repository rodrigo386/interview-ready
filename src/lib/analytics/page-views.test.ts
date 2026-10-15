import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}));

import { isBot, E2E_UA_MARKER, trackPageView } from "./page-views";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7 Safari/537.36";

describe("isBot", () => {
  it("lets a real browser through", () => {
    expect(isBot(CHROME)).toBe(false);
    expect(
      isBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(false);
  });

  it("treats a missing user agent as a bot", () => {
    expect(isBot(null)).toBe(true);
    expect(isBot(undefined)).toBe(true);
  });

  it("catches the usual crawlers", () => {
    expect(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("SomeThing HeadlessChrome/120")).toBe(true);
  });

  // Playwright runs devices["Desktop Chrome"], whose UA is indistinguishable
  // from a real visitor. That put 480 CI page views (48% of the table, 60% of
  // "unique visitors") into the /admin numbers. The config now appends this
  // marker so the rows land as is_bot and drop out of the metrics.
  it("catches our own e2e suite by its UA marker", () => {
    expect(isBot(`${CHROME} ${E2E_UA_MARKER}`)).toBe(true);
  });
});

describe("trackPageView — automated", () => {
  beforeEach(() => insert.mockClear());

  const base = { visitorId: "v1", path: "/", userAgent: CHROME };

  it("visita de pessoa entra como is_bot=false", async () => {
    await trackPageView(base);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ is_bot: false }));
  });

  it("navegador que se declara automatizado entra como is_bot=true, MESMO com user-agent de pessoa", async () => {
    await trackPageView({ ...base, automated: true });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ is_bot: true }));
  });

  it("automated=false não esconde um robô que o user-agent já denuncia", async () => {
    await trackPageView({ ...base, userAgent: "Googlebot/2.1", automated: false });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ is_bot: true }));
  });
});
