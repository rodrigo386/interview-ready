import { describe, it, expect } from "vitest";
import { checkQuota } from "./quota";

describe("checkQuota", () => {
  it("libera com saldo", () => {
    expect(checkQuota({ prep_credits: 1 }, false)).toEqual({ allowed: true, mode: "credit" });
  });

  it("bloqueia com saldo zero", () => {
    expect(checkQuota({ prep_credits: 0 }, false)).toEqual({ allowed: false, mode: "block" });
  });

  // Não deveria acontecer (CHECK prep_credits >= 0), mas negativo não pode liberar.
  it("bloqueia com saldo negativo", () => {
    expect(checkQuota({ prep_credits: -1 }, false)).toEqual({ allowed: false, mode: "block" });
  });

  it("admin passa mesmo sem saldo", () => {
    expect(checkQuota({ prep_credits: 0 }, true)).toEqual({ allowed: true, mode: "credit" });
  });
});
