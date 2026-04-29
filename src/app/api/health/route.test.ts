import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("/api/health", () => {
  it("returns 200 with ok:true and an ISO timestamp", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; ts: string };
    expect(body.ok).toBe(true);
    expect(body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Parsable into a real Date.
    expect(Number.isFinite(new Date(body.ts).getTime())).toBe(true);
  });

  it("sets cache-control no-store so monitors always hit live", async () => {
    const res = await GET();
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toMatch(/no-store/);
  });
});
