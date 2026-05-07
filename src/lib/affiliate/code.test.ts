import { describe, expect, it } from "vitest";
import { validateCode, generateCodeFromName } from "./code";

describe("validateCode", () => {
  it("accepts valid uppercase alphanumeric with hyphens", () => {
    expect(validateCode("ANA-COACH")).toBe(true);
    expect(validateCode("AB")).toBe(true);
    expect(validateCode("PARTNER123")).toBe(true);
    expect(validateCode("A-B-C-D-E-F")).toBe(true);
  });

  it("rejects too short codes", () => {
    expect(validateCode("A")).toBe(false);
    expect(validateCode("")).toBe(false);
  });

  it("rejects too long codes (>40)", () => {
    expect(validateCode("A".repeat(41))).toBe(false);
    expect(validateCode("A".repeat(40))).toBe(true);
  });

  it("rejects lowercase", () => {
    expect(validateCode("ana-coach")).toBe(false);
    expect(validateCode("Ana-Coach")).toBe(false);
  });

  it("rejects whitespace and special chars", () => {
    expect(validateCode("ANA COACH")).toBe(false);
    expect(validateCode("ANA_COACH")).toBe(false);
    expect(validateCode("ANA.COACH")).toBe(false);
    expect(validateCode("ANA/COACH")).toBe(false);
  });

  it("rejects null/undefined gracefully", () => {
    expect(validateCode(null as unknown as string)).toBe(false);
    expect(validateCode(undefined as unknown as string)).toBe(false);
  });
});

describe("generateCodeFromName", () => {
  it("uppercases and replaces spaces with hyphens", () => {
    expect(generateCodeFromName("Ana Costa")).toBe("ANA-COSTA");
  });

  it("strips special chars and accents", () => {
    expect(generateCodeFromName("João da Silva")).toBe("JOAO-DA-SILVA");
    expect(generateCodeFromName("Maria O'Brien")).toBe("MARIA-OBRIEN");
  });

  it("collapses consecutive hyphens", () => {
    expect(generateCodeFromName("Ana   Costa")).toBe("ANA-COSTA");
    expect(generateCodeFromName("Ana - Costa")).toBe("ANA-COSTA");
  });

  it("trims leading/trailing hyphens", () => {
    expect(generateCodeFromName(" Ana Costa ")).toBe("ANA-COSTA");
    expect(generateCodeFromName("- Ana -")).toBe("ANA");
  });

  it("caps at 40 chars", () => {
    const long = "A".repeat(50);
    expect(generateCodeFromName(long).length).toBe(40);
  });

  it("returns empty string for input that has no valid chars", () => {
    expect(generateCodeFromName("...")).toBe("");
    expect(generateCodeFromName("")).toBe("");
  });
});
