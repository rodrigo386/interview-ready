import { beforeEach, describe, expect, it, vi } from "vitest";

type Op = { table: string; verb: string; payload?: Record<string, unknown>; filters: Record<string, unknown> };
let ops: Op[] = [];
let resposta: { data: unknown; error: unknown } = { data: [{ id: "s1" }], error: null };
let usuario: { id: string } | null = { id: "u1" };

function builder(table: string) {
  const op: Op = { table, verb: "select", filters: {} };
  const b = {
    update: (p: Record<string, unknown>) => ((op.verb = "update"), (op.payload = p), b),
    eq: (c: string, v: unknown) => ((op.filters[c] = v), b),
    select: () => b,
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      ops.push({ ...op, filters: { ...op.filters } });
      return Promise.resolve(resposta).then(res, rej);
    },
  };
  return b;
}
const client = {
  from: (t: string) => builder(t),
  auth: { getUser: async () => ({ data: { user: usuario } }) },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

import { setApplicationStatus } from "./status-actions";

beforeEach(() => {
  ops = [];
  resposta = { data: [{ id: "s1" }], error: null };
  usuario = { id: "u1" };
  revalidatePath.mockClear();
});

describe("setApplicationStatus", () => {
  it("grava o status com o carimbo, filtrando pela prep E pelo dono", async () => {
    const r = await setApplicationStatus("s1", "entrevista");
    expect(r).toEqual({ ok: true });
    expect(ops).toHaveLength(1);
    expect(ops[0].table).toBe("prep_sessions");
    expect(ops[0].payload).toMatchObject({ application_status: "entrevista" });
    expect(typeof ops[0].payload!.application_status_at).toBe("string");
    // o admin client ignora RLS: este filtro é a única barreira de posse
    expect(ops[0].filters).toEqual({ id: "s1", user_id: "u1" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("status fora da lista é recusado sem tocar no banco", async () => {
    expect(await setApplicationStatus("s1", "contratado")).toEqual({ ok: false, error: "invalid" });
    expect(await setApplicationStatus("s1", "")).toEqual({ ok: false, error: "invalid" });
    expect(ops).toHaveLength(0);
  });

  it("sem sessão: não escreve nada", async () => {
    usuario = null;
    expect(await setApplicationStatus("s1", "oferta")).toEqual({ ok: false, error: "unauthorized" });
    expect(ops).toHaveLength(0);
  });

  it("prep de outra pessoa afeta zero linhas e vira not_found, nunca sucesso", async () => {
    resposta = { data: [], error: null };
    expect(await setApplicationStatus("de-outra-pessoa", "oferta")).toEqual({ ok: false, error: "not_found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("erro do banco vira failed e não revalida", async () => {
    resposta = { data: null, error: { message: "boom" } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await setApplicationStatus("s1", "encerrada")).toEqual({ ok: false, error: "failed" });
    expect(revalidatePath).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
