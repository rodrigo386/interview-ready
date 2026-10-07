import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLO_PRINCIPAL, EXEMPLOS, getExemplo } from "./data";

const todos = [EXEMPLO_PRINCIPAL, ...EXEMPLOS];

describe("exemplos", () => {
  it("slugs são únicos e em kebab-case (o principal tem slug vazio)", () => {
    const slugs = EXEMPLOS.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(EXEMPLO_PRINCIPAL.slug).toBe("");
  });

  it("getExemplo resolve por slug e devolve undefined pro desconhecido", () => {
    expect(getExemplo(EXEMPLOS[0].slug)).toBe(EXEMPLOS[0]);
    expect(getExemplo("nao-existe")).toBeUndefined();
  });

  it.each(todos.map((e) => [e.area, e] as const))(
    "%s: estrutura completa",
    (_nome, e) => {
      expect(e.score).toBeGreaterThanOrEqual(0);
      expect(e.score).toBeLessThanOrEqual(100);
      expect(e.ats.map((i) => i.nivel)).toEqual(["Crítico", "Alto", "Médio"]);
      expect(e.perguntas.map((q) => q.cor)).toEqual(["orange", "yellow", "green"]);
      // "**" desbalanceado quebraria o destaque da análise.
      for (const i of e.ats) expect((i.texto.match(/\*\*/g) ?? []).length % 2).toBe(0);
      // Perguntas que o candidato FAZ explicam por que funcionam; as demais dão roteiro.
      expect(e.perguntas[2].rotulo).toBe("Por que funciona");
      expect(e.perguntas[0].rotulo).toBe("Roteiro");
    },
  );

  it("o artigo relacionado de cada área existe em content/posts", () => {
    for (const e of EXEMPLOS) {
      if (!e.artigo) continue;
      const arquivo = path.join(process.cwd(), "content", "posts", `${e.artigo}.mdx`);
      expect(fs.existsSync(arquivo), `${e.artigo}.mdx`).toBe(true);
    }
  });
});
