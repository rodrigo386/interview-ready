import { describe, it, expect } from "vitest";
import { detectPixKeyType, MIN_PAYOUT_CENTS } from "./payout";

describe("detectPixKeyType", () => {
  it("detects EMAIL", () => {
    expect(detectPixKeyType("ana@example.com")).toBe("EMAIL");
    expect(detectPixKeyType("rgoalves+pix@gmail.com")).toBe("EMAIL");
  });

  it("detects EVP (random UUID key)", () => {
    expect(
      detectPixKeyType("550e8400-e29b-41d4-a716-446655440000"),
    ).toBe("EVP");
  });

  it("detects CPF (11 digits, with or without formatting)", () => {
    expect(detectPixKeyType("12345678909")).toBe("CPF");
    expect(detectPixKeyType("123.456.789-09")).toBe("CPF");
  });

  it("detects CNPJ (14 digits)", () => {
    expect(detectPixKeyType("12345678000195")).toBe("CNPJ");
    expect(detectPixKeyType("12.345.678/0001-95")).toBe("CNPJ");
  });

  it("detects PHONE with +55 prefix unambiguously", () => {
    expect(detectPixKeyType("+5511987654321")).toBe("PHONE");
    expect(detectPixKeyType("+55 11 98765-4321")).toBe("PHONE");
  });

  it("returns null for ambiguous / invalid keys", () => {
    expect(detectPixKeyType("xxxx")).toBe(null);
    expect(detectPixKeyType("")).toBe(null);
    expect(detectPixKeyType("123")).toBe(null);
    // 12 digits is neither CPF nor CNPJ
    expect(detectPixKeyType("123456789012")).toBe(null);
  });
});

describe("MIN_PAYOUT_CENTS", () => {
  it("is R$100", () => {
    expect(MIN_PAYOUT_CENTS).toBe(10000);
  });
});
