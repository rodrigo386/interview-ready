import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const stubFetch = vi.fn();

beforeEach(() => {
  vi.stubEnv("ASAAS_API_KEY", "test-key");
  vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "test-token");
  vi.stubEnv("ASAAS_BASE_URL", "https://sandbox.asaas.com/api/v3");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  globalThis.fetch = stubFetch as unknown as typeof fetch;
  stubFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function fetchOk(json: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(json),
    text: () => Promise.resolve(JSON.stringify(json)),
  } as unknown as Response);
}

describe("asaas client", () => {
  it("createCustomer posts to /customers with access_token header", async () => {
    stubFetch.mockReturnValueOnce(fetchOk({ id: "cus_1", name: "X", email: "x@y.com" }));
    const { asaas } = await import("./asaas");
    const result = await asaas.createCustomer({
      name: "X",
      email: "x@y.com",
      externalReference: "u1",
    });
    expect(result.id).toBe("cus_1");
    const [url, init] = stubFetch.mock.calls[0];
    expect(url).toBe("https://sandbox.asaas.com/api/v3/customers");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({ access_token: "test-key" });
    const body = JSON.parse(((init as RequestInit).body as string) ?? "");
    expect(body).toEqual({ name: "X", email: "x@y.com", externalReference: "u1" });
  });

  it("createSubscription posts to /subscriptions", async () => {
    stubFetch.mockReturnValueOnce(fetchOk({ id: "sub_1", customer: "cus_1", value: 30, cycle: "MONTHLY", status: "ACTIVE" }));
    const { asaas } = await import("./asaas");
    await asaas.createSubscription({
      customer: "cus_1",
      billingType: "UNDEFINED",
      value: 30,
      cycle: "MONTHLY",
      nextDueDate: "2026-05-01",
      description: "x",
      externalReference: "pro:u1",
    });
    expect(stubFetch).toHaveBeenCalledTimes(1);
    const [url] = stubFetch.mock.calls[0];
    expect(url).toBe("https://sandbox.asaas.com/api/v3/subscriptions");
  });

  it("cancelSubscription deletes /subscriptions/:id", async () => {
    stubFetch.mockReturnValueOnce(fetchOk({ deleted: true }));
    const { asaas } = await import("./asaas");
    await asaas.cancelSubscription("sub_1");
    const [url, init] = stubFetch.mock.calls[0];
    expect(url).toBe("https://sandbox.asaas.com/api/v3/subscriptions/sub_1");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws on non-2xx with response body in message", async () => {
    stubFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 422,
        text: () => Promise.resolve('{"errors":[{"code":"invalid_email"}]}'),
        json: () => Promise.resolve({}),
      } as unknown as Response),
    );
    const { asaas } = await import("./asaas");
    await expect(
      asaas.createCustomer({ name: "X", email: "bad", externalReference: "u1" }),
    ).rejects.toThrow(/422/);
  });
});
