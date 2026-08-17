import { describe, it, expect } from "vitest";
import { classifyRetryRecovery } from "./retry-gate";

const NOW = new Date("2026-08-17T12:00:00.000Z").getTime();
const MIN = 60 * 1000;

describe("classifyRetryRecovery", () => {
  it("failed: desfecho terminal, pode reiniciar", () => {
    expect(
      classifyRetryRecovery({ generationStatus: "failed", updatedAt: null, now: NOW }),
    ).toEqual({ kind: "retryable" });
  });

  it("failed recente: staleness não importa pra failed", () => {
    expect(
      classifyRetryRecovery({
        generationStatus: "failed",
        updatedAt: new Date(NOW - MIN).toISOString(),
        now: NOW,
      }),
    ).toEqual({ kind: "retryable" });
  });

  it("pending travado (>15min): zumbi, pode reiniciar", () => {
    expect(
      classifyRetryRecovery({
        generationStatus: "pending",
        updatedAt: new Date(NOW - 16 * MIN).toISOString(),
        now: NOW,
      }),
    ).toEqual({ kind: "retryable" });
  });

  it("generating travado (>15min): mesmo caso do pending", () => {
    expect(
      classifyRetryRecovery({
        generationStatus: "generating",
        updatedAt: new Date(NOW - 20 * MIN).toISOString(),
        now: NOW,
      }),
    ).toEqual({ kind: "retryable" });
  });

  it("pending recém-escrito (<15min): geração em andamento, recusa", () => {
    expect(
      classifyRetryRecovery({
        generationStatus: "pending",
        updatedAt: new Date(NOW - 1 * MIN).toISOString(),
        now: NOW,
      }),
    ).toEqual({ kind: "still_running" });
  });

  it("generating recém-escrito (<15min): geração em andamento, recusa", () => {
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

  it("complete: preparação entregue, nada a recuperar nem a descartar por aqui", () => {
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
