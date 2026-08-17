import { describe, it, expect } from "vitest";
import { buildExternalReference, parseExternalReference } from "./ids";

describe("externalReference de compra de prep", () => {
  it("carrega a quantidade", () => {
    const raw = buildExternalReference({
      kind: "prep_purchase", userId: "u1", qty: 3, nano: "abc",
    });
    expect(raw).toBe("prep:u1:3:abc");
  });

  it("faz o round-trip", () => {
    const parsed = parseExternalReference("prep:u1:5:xyz");
    expect(parsed).toEqual({ kind: "prep_purchase", userId: "u1", qty: 5, nano: "xyz" });
  });

  // Pagamento criado antes do deploy chega no webhook depois dele.
  it("trata o formato antigo como 1 crédito", () => {
    const parsed = parseExternalReference("prep:u1:abc");
    expect(parsed).toEqual({ kind: "prep_purchase", userId: "u1", qty: 1, nano: "abc" });
  });

  it("recusa quantidade que não é número", () => {
    expect(parseExternalReference("prep:u1:tres:abc")).toBeNull();
  });

  it("recusa quantidade fora dos SKUs", () => {
    expect(parseExternalReference("prep:u1:99:abc")).toBeNull();
  });

  it("continua entendendo a assinatura antiga", () => {
    expect(parseExternalReference("pro:u1")).toEqual({
      kind: "pro_subscription", userId: "u1",
    });
  });
});
