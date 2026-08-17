import { describe, it, expect, vi } from "vitest";
import { consumePrepCredit, refundPrepCredit, creditPrepRefundUnconditional } from "./consume";

const fakeSb = (rpcResult: { data: unknown; error: unknown }) =>
  ({ rpc: vi.fn(async () => rpcResult) }) as never;

describe("consumePrepCredit", () => {
  it("segue quando a função devolve true", async () => {
    const sb = fakeSb({ data: true, error: null });
    expect(await consumePrepCredit(sb, "u1", "s1", false)).toBe(true);
  });

  it("barra quando a função devolve false (sem saldo)", async () => {
    const sb = fakeSb({ data: false, error: null });
    expect(await consumePrepCredit(sb, "u1", "s1", false)).toBe(false);
  });

  it("barra quando o RPC erra — falhar fechado, não dar prep de graça", async () => {
    const sb = fakeSb({ data: null, error: { message: "boom" } });
    expect(await consumePrepCredit(sb, "u1", "s1", false)).toBe(false);
  });

  it("admin passa sem tocar no RPC", async () => {
    const sb = { rpc: vi.fn() } as never;
    expect(await consumePrepCredit(sb, "u1", "s1", true)).toBe(true);
    expect((sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });

  it("passa userId e sessionId pro RPC — o consumo marca credit_consumed_at NA sessão", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    await consumePrepCredit({ rpc } as never, "u1", "s1", false);
    expect(rpc).toHaveBeenCalledWith("consume_prep_credit", {
      p_user_id: "u1",
      p_session_id: "s1",
    });
  });
});

describe("refundPrepCredit", () => {
  it("devolve o crédito consumido, passando userId e sessionId — devolução é idempotente POR SESSÃO", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    await refundPrepCredit({ rpc } as never, "u1", "s1", false);
    expect(rpc).toHaveBeenCalledWith("refund_prep_credit", {
      p_user_id: "u1",
      p_session_id: "s1",
    });
  });

  it("não devolve nada pra admin, que não consumiu", async () => {
    const rpc = vi.fn();
    await refundPrepCredit({ rpc } as never, "u1", "s1", true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não lança quando o RPC erra", async () => {
    const rpc = vi.fn(async () => ({ error: { message: "boom" } }));
    await expect(
      refundPrepCredit({ rpc } as never, "u1", "s1", false),
    ).resolves.toBeUndefined();
  });

  it("não lança quando o RPC devolve false (no-op idempotente — já tinha devolvido ou nunca consumiu)", async () => {
    const rpc = vi.fn(async () => ({ data: false, error: null }));
    await expect(
      refundPrepCredit({ rpc } as never, "u1", "s1", false),
    ).resolves.toBeUndefined();
  });
});

describe("creditPrepRefundUnconditional", () => {
  it("credita sem checagem de sessão — usado só depois que o caller (deleteFailedPrep) já provou que é devido", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await creditPrepRefundUnconditional({ rpc } as never, "u1", false);
    expect(rpc).toHaveBeenCalledWith("credit_prep_refund", { p_user_id: "u1" });
  });

  it("não credita pra admin", async () => {
    const rpc = vi.fn();
    await creditPrepRefundUnconditional({ rpc } as never, "u1", true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não lança quando o RPC erra", async () => {
    const rpc = vi.fn(async () => ({ error: { message: "boom" } }));
    await expect(
      creditPrepRefundUnconditional({ rpc } as never, "u1", false),
    ).resolves.toBeUndefined();
  });
});
