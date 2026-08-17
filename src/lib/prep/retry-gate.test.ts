import { describe, it, expect } from "vitest";
import { classifyRetryRecovery } from "./retry-gate";

const NOW = new Date("2026-08-17T12:00:00.000Z").getTime();
const MIN = 60 * 1000;

describe("classifyRetryRecovery", () => {
  it("failed: o crédito já foi devolvido por runGenerationInBackground — retry cobra de novo", () => {
    expect(
      classifyRetryRecovery({ generationStatus: "failed", updatedAt: null, now: NOW }),
    ).toEqual({ kind: "failed_refunded" });
  });

  it("failed: cobra independente de updatedAt (staleness não importa pra failed)", () => {
    expect(
      classifyRetryRecovery({
        generationStatus: "failed",
        updatedAt: new Date(NOW - MIN).toISOString(),
        now: NOW,
      }),
    ).toEqual({ kind: "failed_refunded" });
  });

  it("pending travado (>15min): o runner que devolveria morreu junto — retry não cobra", () => {
    expect(
      classifyRetryRecovery({
        generationStatus: "pending",
        updatedAt: new Date(NOW - 16 * MIN).toISOString(),
        now: NOW,
      }),
    ).toEqual({ kind: "zombie_unrefunded" });
  });

  it("generating travado (>15min): mesmo caso do pending — retry não cobra", () => {
    expect(
      classifyRetryRecovery({
        generationStatus: "generating",
        updatedAt: new Date(NOW - 20 * MIN).toISOString(),
        now: NOW,
      }),
    ).toEqual({ kind: "zombie_unrefunded" });
  });

  it("pending recém-escrito (<15min): geração em andamento, retry recusa", () => {
    expect(
      classifyRetryRecovery({
        generationStatus: "pending",
        updatedAt: new Date(NOW - 1 * MIN).toISOString(),
        now: NOW,
      }),
    ).toEqual({ kind: "still_running" });
  });

  it("generating recém-escrito (<15min): geração em andamento, retry recusa", () => {
    expect(
      classifyRetryRecovery({
        generationStatus: "generating",
        updatedAt: new Date(NOW - 30 * 1000).toISOString(),
        now: NOW,
      }),
    ).toEqual({ kind: "still_running" });
  });

  it("pending sem updatedAt: não dá pra provar que é zumbi, recusa por segurança", () => {
    expect(
      classifyRetryRecovery({ generationStatus: "pending", updatedAt: null, now: NOW }),
    ).toEqual({ kind: "still_running" });
  });

  it("complete: nada a recuperar, retry não deveria nem rodar", () => {
    expect(
      classifyRetryRecovery({ generationStatus: "complete", updatedAt: null, now: NOW }),
    ).toEqual({ kind: "not_retryable" });
  });

  it("null: nada a recuperar", () => {
    expect(
      classifyRetryRecovery({ generationStatus: null, updatedAt: null, now: NOW }),
    ).toEqual({ kind: "not_retryable" });
  });
});
