import { describe, it, expect } from "vitest";
import { detectarInertes, avisarIntegracoesInertes, INTEGRACOES_INERTES } from "./env";

const TUDO_SETADO = Object.fromEntries(
  INTEGRACOES_INERTES.map((i) => [i.envVar, "valor"]),
);

describe("detectarInertes", () => {
  it("não acusa nada quando tudo está configurado", () => {
    expect(detectarInertes(TUDO_SETADO)).toEqual([]);
  });

  it("acusa variável ausente", () => {
    const { NEXT_PUBLIC_POSTHOG_KEY: _, ...semPosthog } = TUDO_SETADO;
    const r = detectarInertes(semPosthog);
    expect(r.map((i) => i.envVar)).toEqual(["NEXT_PUBLIC_POSTHOG_KEY"]);
  });

  it("trata string vazia como ausente", () => {
    // O next.config.ts inlina env vars: uma var não setada no build vira ""
    // e não undefined. Foi exatamente assim que o PostHog ficou desligado.
    const r = detectarInertes({ ...TUDO_SETADO, NEXT_PUBLIC_POSTHOG_KEY: "" });
    expect(r.map((i) => i.envVar)).toEqual(["NEXT_PUBLIC_POSTHOG_KEY"]);
  });

  it("trata espaço em branco como ausente", () => {
    const r = detectarInertes({ ...TUDO_SETADO, UPSTASH_REDIS_REST_TOKEN: "   " });
    expect(r.map((i) => i.envVar)).toEqual(["UPSTASH_REDIS_REST_TOKEN"]);
  });

  it("acusa todas de uma vez", () => {
    expect(detectarInertes({})).toHaveLength(INTEGRACOES_INERTES.length);
  });

  it("toda entrada explica a consequência, não só o nome", () => {
    // O valor do aviso está em dizer o que PARA de funcionar. "UPSTASH
    // ausente" não move ninguém; "rate limits inertes" move.
    for (const i of INTEGRACOES_INERTES) {
      expect(i.consequencia.length).toBeGreaterThan(20);
    }
  });
});

describe("avisarIntegracoesInertes", () => {
  function capturar(fn: () => void): string[] {
    const saida: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => saida.push(args.join(" "));
    try {
      fn();
    } finally {
      console.warn = original;
    }
    return saida;
  }

  it("cala a boca fora de produção — aviso ignorado não é aviso", () => {
    expect(capturar(() => avisarIntegracoesInertes({}, false))).toEqual([]);
  });

  it("grita em produção listando cada integração desligada", () => {
    const saida = capturar(() => avisarIntegracoesInertes({}, true));
    expect(saida).toHaveLength(1);
    expect(saida[0]).toContain("NEXT_PUBLIC_POSTHOG_KEY");
    expect(saida[0]).toContain("UPSTASH_REDIS_REST_URL");
  });

  it("não grita em produção quando está tudo certo", () => {
    expect(capturar(() => avisarIntegracoesInertes(TUDO_SETADO, true))).toEqual([]);
  });
});
