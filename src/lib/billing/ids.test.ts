import { describe, expect, it } from "vitest";
import { buildExternalReference, parseExternalReference } from "./ids";

describe("externalReference", () => {
  it("builds pro reference from user id", () => {
    expect(buildExternalReference({ kind: "pro_subscription", userId: "u1" }))
      .toBe("pro:u1");
  });

  it("builds per-use reference with nanoid suffix", () => {
    const ref = buildExternalReference({ kind: "prep_purchase", userId: "u1", nano: "abc123" });
    expect(ref).toBe("prep:u1:abc123");
  });

  it("parses pro reference", () => {
    expect(parseExternalReference("pro:u1")).toEqual({
      kind: "pro_subscription",
      userId: "u1",
    });
  });

  it("parses prep reference", () => {
    expect(parseExternalReference("prep:u1:abc")).toEqual({
      kind: "prep_purchase",
      userId: "u1",
      nano: "abc",
    });
  });

  it("returns null on garbage", () => {
    expect(parseExternalReference("garbage")).toBeNull();
    expect(parseExternalReference("")).toBeNull();
    expect(parseExternalReference(null)).toBeNull();
    expect(parseExternalReference("foo:bar")).toBeNull();
  });
});
