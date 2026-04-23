import { describe, expect, it } from "vitest";
import {
  computeServerCompleted,
  mergeCompleted,
  resolveCurrentStep,
} from "./step-state";

describe("computeServerCompleted", () => {
  it("step 1 completo quando guideReady=true", () => {
    expect(computeServerCompleted({ guideReady: true, atsComplete: false })).toEqual([1]);
  });
  it("steps 1+2 quando ats está complete", () => {
    expect(computeServerCompleted({ guideReady: true, atsComplete: true })).toEqual([1, 2]);
  });
  it("vazio quando guide não pronto", () => {
    expect(computeServerCompleted({ guideReady: false, atsComplete: false })).toEqual([]);
  });
});

describe("mergeCompleted", () => {
  it("une server e local sem duplicar e ordena", () => {
    expect(mergeCompleted([1, 2], [3, 1, 5])).toEqual([1, 2, 3, 5]);
  });
  it("ignora valores fora de 1..5", () => {
    expect(mergeCompleted([1], [9, 0, 3])).toEqual([1, 3]);
  });
});

describe("resolveCurrentStep", () => {
  it("retorna o menor step não completado", () => {
    expect(resolveCurrentStep([1, 2])).toBe(3);
  });
  it("clampa em 5 se todos completos", () => {
    expect(resolveCurrentStep([1, 2, 3, 4, 5])).toBe(5);
  });
  it("retorna 1 se nada completo", () => {
    expect(resolveCurrentStep([])).toBe(1);
  });
  it("pula gaps no meio", () => {
    expect(resolveCurrentStep([1, 3, 5])).toBe(2);
  });
});
