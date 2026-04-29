import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// The route imports `createAdminClient` from "@/lib/supabase/admin". Mock it
// at module scope so we never hit a real Supabase project.
const listUsersMock = vi.fn();
const updateUserByIdMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        listUsers: listUsersMock,
        updateUserById: updateUserByIdMock,
      },
    },
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  listUsersMock.mockReset();
  updateUserByIdMock.mockReset();
  // Default unset — endpoint should appear non-existent.
  vi.unstubAllEnvs();
});
afterEach(() => vi.unstubAllEnvs());

function makeReq(opts: { headers?: Record<string, string>; body?: unknown }) {
  return new Request("http://localhost/api/test/confirm-user", {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe("/api/test/confirm-user — kill switch behavior", () => {
  it("returns 404 when E2E_BYPASS_SECRET env is unset (endpoint disabled)", async () => {
    const res = await POST(makeReq({ headers: { "x-e2e-secret": "anything" }, body: {} }));
    expect(res.status).toBe(404);
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("returns 404 when secret env is set but header is missing (timing-safe miss)", async () => {
    vi.stubEnv("E2E_BYPASS_SECRET", "correct-secret-value");
    const res = await POST(makeReq({ body: { email: "e2e-foo@example.com" } }));
    expect(res.status).toBe(404);
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("returns 404 when header doesn't match secret", async () => {
    vi.stubEnv("E2E_BYPASS_SECRET", "correct-secret-value");
    const res = await POST(
      makeReq({
        headers: { "x-e2e-secret": "wrong-secret-value-x" },
        body: { email: "e2e-foo@example.com" },
      }),
    );
    expect(res.status).toBe(404);
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("returns 404 when header has the right value but wrong length (constant-time guard)", async () => {
    vi.stubEnv("E2E_BYPASS_SECRET", "correct-secret-value");
    const res = await POST(
      makeReq({
        headers: { "x-e2e-secret": "correct-secret-value-extra" },
        body: { email: "e2e-foo@example.com" },
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("/api/test/confirm-user — input validation", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_BYPASS_SECRET", "secret");
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await new Request("http://localhost/api/test/confirm-user", {
      method: "POST",
      headers: { "content-type": "application/json", "x-e2e-secret": "secret" },
      body: "not-json{",
    });
    const out = await POST(res);
    expect(out.status).toBe(400);
  });

  it("returns 400 when email field is missing", async () => {
    const res = await POST(makeReq({ headers: { "x-e2e-secret": "secret" }, body: {} }));
    expect(res.status).toBe(400);
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("returns 400 when email is malformed (no @)", async () => {
    const res = await POST(
      makeReq({ headers: { "x-e2e-secret": "secret" }, body: { email: "not-an-email" } }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-test emails with 422 (defense in depth — secret leak mitigation)", async () => {
    const res = await POST(
      makeReq({
        headers: { "x-e2e-secret": "secret" },
        body: { email: "real-user@gmail.com" },
      }),
    );
    expect(res.status).toBe(422);
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("rejects e2e prefix on non-example.com domain", async () => {
    const res = await POST(
      makeReq({
        headers: { "x-e2e-secret": "secret" },
        body: { email: "e2e-attacker@real.com" },
      }),
    );
    expect(res.status).toBe(422);
  });

  it("accepts e2e-*@example.com format", async () => {
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: "u1", email: "e2e-good@example.com" }] },
      error: null,
    });
    updateUserByIdMock.mockResolvedValue({ error: null });
    const res = await POST(
      makeReq({
        headers: { "x-e2e-secret": "secret" },
        body: { email: "e2e-good@example.com" },
      }),
    );
    expect(res.status).toBe(200);
    expect(updateUserByIdMock).toHaveBeenCalledWith("u1", { email_confirm: true });
  });
});

describe("/api/test/confirm-user — admin client orchestration", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_BYPASS_SECRET", "secret");
  });

  it("returns 404 when listUsers does not find the email", async () => {
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: "other", email: "e2e-other@example.com" }] },
      error: null,
    });
    const res = await POST(
      makeReq({
        headers: { "x-e2e-secret": "secret" },
        body: { email: "e2e-missing@example.com" },
      }),
    );
    expect(res.status).toBe(404);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("returns 500 when listUsers errors", async () => {
    listUsersMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(
      makeReq({
        headers: { "x-e2e-secret": "secret" },
        body: { email: "e2e-x@example.com" },
      }),
    );
    expect(res.status).toBe(500);
  });

  it("returns 500 when updateUserById errors", async () => {
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: "u1", email: "e2e-x@example.com" }] },
      error: null,
    });
    updateUserByIdMock.mockResolvedValue({ error: { message: "db down" } });
    const res = await POST(
      makeReq({
        headers: { "x-e2e-secret": "secret" },
        body: { email: "e2e-x@example.com" },
      }),
    );
    expect(res.status).toBe(500);
  });

  it("matches email case-insensitively (DB stores lowercased)", async () => {
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: "u1", email: "e2e-x@example.com" }] },
      error: null,
    });
    updateUserByIdMock.mockResolvedValue({ error: null });
    const res = await POST(
      makeReq({
        headers: { "x-e2e-secret": "secret" },
        body: { email: "E2E-X@EXAMPLE.COM" },
      }),
    );
    expect(res.status).toBe(200);
  });
});
