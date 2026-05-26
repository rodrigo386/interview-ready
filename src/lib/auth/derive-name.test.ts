import { describe, it, expect } from "vitest";
import { deriveNameFromEmail } from "./derive-name";

describe("deriveNameFromEmail", () => {
  it("splits on dots", () => {
    expect(deriveNameFromEmail("ana.silva@example.com")).toBe("Ana Silva");
  });

  it("splits on underscores", () => {
    expect(deriveNameFromEmail("joao_pedro@example.com")).toBe("Joao Pedro");
  });

  it("splits on plus", () => {
    expect(deriveNameFromEmail("maria+spam@example.com")).toBe("Maria Spam");
  });

  it("splits on camelHumps", () => {
    expect(deriveNameFromEmail("anaSilva@example.com")).toBe("Ana Silva");
  });

  it("handles single-word locals", () => {
    expect(deriveNameFromEmail("rodrigo@example.com")).toBe("Rodrigo");
  });

  it("handles numbers in local-part", () => {
    expect(deriveNameFromEmail("user123@example.com")).toBe("User123");
  });

  it("handles already-capitalized", () => {
    expect(deriveNameFromEmail("RodrigoAlves@example.com")).toBe("Rodrigo Alves");
  });

  it("returns empty string for malformed input", () => {
    expect(deriveNameFromEmail("")).toBe("");
    expect(deriveNameFromEmail("@example.com")).toBe("");
  });

  it("handles multiple consecutive separators", () => {
    expect(deriveNameFromEmail("ana...silva@example.com")).toBe("Ana Silva");
  });
});
