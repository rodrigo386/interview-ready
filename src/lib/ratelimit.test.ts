import { describe, expect, it, vi, afterEach } from "vitest";
import { LIMITS, formatResetPhrase } from "./ratelimit";

describe("LIMITS auth shapes", () => {
  it("login: 10 / 600s, signup: 5 / 3600s, reset: 3 / 600s", () => {
    expect(LIMITS.authLogin).toMatchObject({ limit: 10, windowSeconds: 600 });
    expect(LIMITS.authSignup).toMatchObject({ limit: 5, windowSeconds: 3600 });
    expect(LIMITS.passwordReset).toMatchObject({ limit: 3, windowSeconds: 600 });
  });

  it("each limit has a unique key (no Redis bucket collision)", () => {
    const keys = Object.values(LIMITS).map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("formatResetPhrase", () => {
  const NOW = 1_700_000_000_000;
  afterEach(() => vi.useRealTimers());

  function withFrozenNow() {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  }

  it("returns 'alguns segundos' when reset is in the past", () => {
    withFrozenNow();
    expect(formatResetPhrase(NOW - 5_000)).toBe("alguns segundos");
  });

  it("returns 'alguns segundos' for less than 1 minute remaining", () => {
    withFrozenNow();
    expect(formatResetPhrase(NOW + 30_000)).toBe("alguns segundos");
  });

  it("returns minutes for 1-59 minutes remaining", () => {
    withFrozenNow();
    expect(formatResetPhrase(NOW + 5 * 60_000)).toBe("5 minutos");
    expect(formatResetPhrase(NOW + 59 * 60_000)).toBe("59 minutos");
  });

  it("returns '1 hora' for exactly 60 minutes (singular)", () => {
    withFrozenNow();
    expect(formatResetPhrase(NOW + 60 * 60_000)).toBe("1 hora");
  });

  it("returns 'N horas' for more than 1 hour (plural)", () => {
    withFrozenNow();
    expect(formatResetPhrase(NOW + 2 * 60 * 60_000)).toBe("2 horas");
    expect(formatResetPhrase(NOW + 24 * 60 * 60_000)).toBe("24 horas");
  });

  it("never returns negative or zero — always at least 'alguns segundos'", () => {
    withFrozenNow();
    expect(formatResetPhrase(0)).toBe("alguns segundos");
    expect(formatResetPhrase(NOW - 999_999)).toBe("alguns segundos");
  });
});
