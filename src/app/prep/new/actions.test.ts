import { describe, it, expect } from "vitest";
import { createPrepInputSchema } from "./actions";

const base = {
  jobTitle: "Senior Director",
  companyName: "Acme",
  jobDescription: "x".repeat(300),
};

describe("createPrepInputSchema", () => {
  it("accepts cvId only", () => {
    const result = createPrepInputSchema.safeParse({
      ...base,
      cvId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("accepts cvText only", () => {
    const result = createPrepInputSchema.safeParse({
      ...base,
      cvText: "x".repeat(300),
    });
    expect(result.success).toBe(true);
  });

  it("rejects both cvId and cvText", () => {
    const result = createPrepInputSchema.safeParse({
      ...base,
      cvId: "11111111-1111-1111-1111-111111111111",
      cvText: "x".repeat(300),
    });
    expect(result.success).toBe(false);
  });

  it("rejects neither cvId nor cvText", () => {
    const result = createPrepInputSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejects invalid cvId uuid", () => {
    const result = createPrepInputSchema.safeParse({ ...base, cvId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});
