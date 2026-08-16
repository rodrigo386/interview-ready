import { describe, it, expect, vi, beforeEach } from "vitest";
import { isOverDailyCap, ANON_COOKIE } from "./repo";

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

// hashIp lê `env.IP_HASH_SALT`, que é lido (e cacheado) lazily. Cada teste
// reseta o registro de módulos e importa `./repo` de novo pra forçar o
// `env` a reparsear `process.env` com o stub daquele teste.
describe("hashIp", () => {
  const REQUIRED_ENV = {
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it("com salt configurado, é estável para o mesmo IP e difere entre IPs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", REQUIRED_ENV.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", REQUIRED_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    vi.stubEnv("IP_HASH_SALT", "salt-de-teste");
    const { hashIp } = await import("./repo");

    const hashA = hashIp("1.2.3.4");
    const hashB = hashIp("1.2.3.5");
    expect(hashA).toBe(hashIp("1.2.3.4"));
    expect(hashA).not.toBe(hashB);
    expect(hashA).not.toContain("1.2.3.4");
  });

  it("sem salt configurado, devolve null", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", REQUIRED_ENV.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", REQUIRED_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    vi.stubEnv("IP_HASH_SALT", "");
    const { hashIp } = await import("./repo");

    expect(hashIp("1.2.3.4")).toBeNull();
  });
});

describe("ANON_COOKIE", () => {
  it("tem nome estável", () => {
    expect(ANON_COOKIE).toBe("pv_anon_ats");
  });
});
