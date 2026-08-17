import { describe, it, expect, vi } from "vitest";
import { consumePrepCredit, refundPrepCredit } from "./consume";

const fakeSb = (rpcResult: { data: unknown; error: unknown }) =>
  ({ rpc: vi.fn(async () => rpcResult) }) as never;

describe("consumePrepCredit", () => {
  it("segue quando a função devolve true", async () => {
    const sb = fakeSb({ data: true, error: null });
    expect(await consumePrepCredit(sb, "u1", false)).toBe(true);
  });

  it("barra quando a função devolve false (sem saldo)", async () => {
    const sb = fakeSb({ data: false, error: null });
    expect(await consumePrepCredit(sb, "u1", false)).toBe(false);
  });

  it("barra quando o RPC erra — falhar fechado, não dar prep de graça", async () => {
    const sb = fakeSb({ data: null, error: { message: "boom" } });
    expect(await consumePrepCredit(sb, "u1", false)).toBe(false);
  });

  it("admin passa sem tocar no RPC", async () => {
    const sb = { rpc: vi.fn() } as never;
    expect(await consumePrepCredit(sb, "u1", true)).toBe(true);
    expect((sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });
});

describe("refundPrepCredit", () => {
  it("devolve o crédito consumido", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await refundPrepCredit({ rpc } as never, "u1", false);
    expect(rpc).toHaveBeenCalledWith("refund_prep_credit", { p_user_id: "u1" });
  });

  it("não devolve nada pra admin, que não consumiu", async () => {
    const rpc = vi.fn();
    await refundPrepCredit({ rpc } as never, "u1", true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não lança quando o RPC erra", async () => {
    const rpc = vi.fn(async () => ({ error: { message: "boom" } }));
    await expect(refundPrepCredit({ rpc } as never, "u1", false)).resolves.toBeUndefined();
  });
});
