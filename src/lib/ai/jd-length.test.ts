import { describe, expect, it } from "vitest";
import { isJdTooShort, jdWordCount, MIN_JD_WORDS } from "./jd-length";

describe("isJdTooShort", () => {
  it("a vaga de uma linha que gerou nota 7 é curta", () => {
    expect(isJdTooShort("vaga === gerente geral de supermercado")).toBe(true);
  });
  it("vazia/nula é curta", () => {
    expect(isJdTooShort("")).toBe(true);
    expect(isJdTooShort(null)).toBe(true);
    expect(isJdTooShort("   \n ")).toBe(true);
  });
  it("no limite deixa de ser curta", () => {
    const n = (k: number) => Array.from({ length: k }, () => "palavra").join(" ");
    expect(isJdTooShort(n(MIN_JD_WORDS - 1))).toBe(true);
    expect(isJdTooShort(n(MIN_JD_WORDS))).toBe(false);
  });
  it("conta palavras ignorando espaços e quebras repetidas", () => {
    expect(jdWordCount("  a  b\n\nc ")).toBe(3);
  });
});
