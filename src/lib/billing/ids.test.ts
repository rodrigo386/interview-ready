import { describe, it, expect } from "vitest";
import { buildExternalReference, parseExternalReference } from "./ids";

describe("externalReference", () => {
  // Testes de pro_subscription (legado — recuperados)
  it("builds pro reference from user id", () => {
    expect(buildExternalReference({ kind: "pro_subscription", userId: "u1" }))
      .toBe("pro:u1");
  });

  it("parses pro reference", () => {
    expect(parseExternalReference("pro:u1")).toEqual({
      kind: "pro_subscription",
      userId: "u1",
    });
  });

  // Testes de prep_purchase com quantidade (novos — Brief)
  it("carrega a quantidade", () => {
    const raw = buildExternalReference({
      kind: "prep_purchase", userId: "u1", qty: 3, nano: "abc",
    });
    expect(raw).toBe("prep:u1:3:abc");
  });

  it("faz o round-trip com 4 partes (novo formato)", () => {
    const parsed = parseExternalReference("prep:u1:5:xyz");
    expect(parsed).toEqual({ kind: "prep_purchase", userId: "u1", qty: 5, nano: "xyz" });
  });

  it("faz round-trip com qty=1 no formato novo (4 partes)", () => {
    const raw = buildExternalReference({
      kind: "prep_purchase", userId: "u2", qty: 1, nano: "def",
    });
    expect(raw).toBe("prep:u2:1:def");
    const parsed = parseExternalReference(raw);
    expect(parsed).toEqual({ kind: "prep_purchase", userId: "u2", qty: 1, nano: "def" });
  });

  // Pagamento criado antes do deploy chega no webhook depois dele.
  it("trata o formato antigo (3 partes) como 1 crédito", () => {
    const parsed = parseExternalReference("prep:u1:abc");
    expect(parsed).toEqual({ kind: "prep_purchase", userId: "u1", qty: 1, nano: "abc" });
  });

  // Validação de quantidade (recuperados + novos)
  it("recusa quantidade que não é número", () => {
    expect(parseExternalReference("prep:u1:tres:abc")).toBeNull();
  });

  it("recusa quantidade NEGATIVA", () => {
    expect(parseExternalReference("prep:u1:-3:abc")).toBeNull();
  });

  it("recusa quantidade DECIMAL", () => {
    expect(parseExternalReference("prep:u1:3.5:abc")).toBeNull();
  });

  it("recusa quantidade fora dos SKUs (validados)", () => {
    expect(parseExternalReference("prep:u1:99:abc")).toBeNull();
  });

  it("recusa quantidade absurda", () => {
    expect(parseExternalReference("prep:u1:999999:abc")).toBeNull();
  });

  it("recusa nano contendo ':' (parse ambíguo)", () => {
    expect(parseExternalReference("prep:u1:3:ab:cd")).toBeNull();
  });

  // Validação de estrutura (recuperados)
  it("returns null on null", () => {
    expect(parseExternalReference(null)).toBeNull();
  });

  it("returns null on undefined", () => {
    expect(parseExternalReference(undefined)).toBeNull();
  });

  it("returns null on empty string", () => {
    expect(parseExternalReference("")).toBeNull();
  });

  it("returns null on garbage without structure", () => {
    expect(parseExternalReference("garbage")).toBeNull();
  });

  it("returns null on malformed pair", () => {
    expect(parseExternalReference("foo:bar")).toBeNull();
  });
});
