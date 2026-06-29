import { describe, it, expect } from "vitest";
import { isGenerationStale, STALE_GENERATION_MS } from "./generation-stale";

const NOW = 1_700_000_000_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("isGenerationStale", () => {
  it("is false for terminal statuses regardless of age", () => {
    expect(isGenerationStale("complete", ago(STALE_GENERATION_MS * 10), NOW)).toBe(false);
    expect(isGenerationStale("failed", ago(STALE_GENERATION_MS * 10), NOW)).toBe(false);
  });

  it("is false for a fresh generating/pending prep", () => {
    expect(isGenerationStale("generating", ago(60_000), NOW)).toBe(false);
    expect(isGenerationStale("pending", ago(0), NOW)).toBe(false);
  });

  it("is true for generating older than the threshold (zombie)", () => {
    expect(isGenerationStale("generating", ago(STALE_GENERATION_MS + 1000), NOW)).toBe(true);
  });

  it("is true for a long-stuck pending prep", () => {
    expect(isGenerationStale("pending", ago(STALE_GENERATION_MS * 100), NOW)).toBe(true);
  });

  it("is false exactly at the threshold (must exceed)", () => {
    expect(isGenerationStale("generating", ago(STALE_GENERATION_MS), NOW)).toBe(false);
  });

  it("is false when createdAt is missing or invalid", () => {
    expect(isGenerationStale("generating", null, NOW)).toBe(false);
    expect(isGenerationStale("generating", undefined, NOW)).toBe(false);
    expect(isGenerationStale("generating", "not-a-date", NOW)).toBe(false);
  });
});
