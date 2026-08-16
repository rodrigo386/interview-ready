import { describe, it, expect } from "vitest";
import { isOverDailyCap, hashIp, ANON_COOKIE } from "./repo";

describe("isOverDailyCap", () => {
  it("libera abaixo do teto", () => {
    expect(isOverDailyCap(199, 200)).toBe(false);
  });
  it("bloqueia no teto", () => {
    expect(isOverDailyCap(200, 200)).toBe(true);
  });
  it("bloqueia acima do teto", () => {
    expect(isOverDailyCap(201, 200)).toBe(true);
  });
});

describe("hashIp", () => {
  it("é estável para o mesmo IP", () => {
    expect(hashIp("1.2.3.4")).toBe(hashIp("1.2.3.4"));
  });
  it("difere entre IPs", () => {
    expect(hashIp("1.2.3.4")).not.toBe(hashIp("1.2.3.5"));
  });
  it("não contém o IP original", () => {
    expect(hashIp("1.2.3.4")).not.toContain("1.2.3.4");
  });
});

describe("ANON_COOKIE", () => {
  it("tem nome estável", () => {
    expect(ANON_COOKIE).toBe("pv_anon_ats");
  });
});
