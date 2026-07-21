import { describe, expect, it } from "vitest";
import { parseOtpType, postConfirmRedirect } from "./otp-type";

describe("parseOtpType", () => {
  it("aceita os tipos válidos do Supabase", () => {
    for (const t of ["signup", "invite", "magiclink", "recovery", "email_change", "email"]) {
      expect(parseOtpType(t)).toBe(t);
    }
  });

  it("rejeita valores desconhecidos, vazios e nulos", () => {
    expect(parseOtpType("sms")).toBeNull();
    expect(parseOtpType("SIGNUP")).toBeNull();
    expect(parseOtpType("")).toBeNull();
    expect(parseOtpType(null)).toBeNull();
    expect(parseOtpType(undefined)).toBeNull();
  });
});

describe("postConfirmRedirect", () => {
  it("recovery vai pro /reset, resto pro /dashboard", () => {
    expect(postConfirmRedirect("recovery")).toBe("/reset");
    expect(postConfirmRedirect("signup")).toBe("/dashboard");
    expect(postConfirmRedirect("magiclink")).toBe("/dashboard");
  });
});
