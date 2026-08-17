import { describe, it, expect } from "vitest";
import { classifyRetryRecovery } from "./retry-gate";

describe("classifyRetryRecovery", () => {
  it("failed: o crédito já foi devolvido por runGenerationInBackground — retry cobra de novo", () => {
    expect(classifyRetryRecovery("failed")).toEqual({ kind: "failed_refunded" });
  });

  it("pending travado: o runner que devolveria morreu junto — retry não cobra", () => {
    expect(classifyRetryRecovery("pending")).toEqual({ kind: "zombie_unrefunded" });
  });

  it("generating travado: mesmo caso do pending — retry não cobra", () => {
    expect(classifyRetryRecovery("generating")).toEqual({ kind: "zombie_unrefunded" });
  });

  it("complete: nada a recuperar, retry não deveria nem rodar", () => {
    expect(classifyRetryRecovery("complete")).toEqual({ kind: "not_retryable" });
  });

  it("null: nada a recuperar", () => {
    expect(classifyRetryRecovery(null)).toEqual({ kind: "not_retryable" });
  });
});
