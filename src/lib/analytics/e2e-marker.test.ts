import { describe, expect, it } from "vitest";
import config from "../../../playwright.config";
import { E2E_UA_MARKER, isBot } from "./page-views";

/**
 * Guarda de um bug real: de 15/08 a 09/10/2026 o marcador do user-agent do
 * Playwright se perdeu e 548 visitas do CI (70 execuções) entraram nos números
 * de tráfego, porque `use` de PROJETO sobrescreve o `use` global e o spread de
 * `devices["Desktop Chrome"]` traz o user-agent padrão. Nada falhava: o painel
 * só ficou inflado, e a análise de tráfego passou semanas lendo o CI como gente.
 */
describe("playwright.config — marcador de CI no user-agent", () => {
  it("o marcador do config é o mesmo que o isBot procura", async () => {
    const fonte = (await import("node:fs")).readFileSync("playwright.config.ts", "utf8");
    expect(fonte).toContain(`const E2E_UA_MARKER = "${E2E_UA_MARKER}"`);
  });

  it("TODO projeto tem o marcador no próprio use.userAgent (projeto sobrescreve o global)", () => {
    const projetos = config.projects ?? [];
    expect(projetos.length).toBeGreaterThan(0);
    for (const p of projetos) {
      const ua = p.use?.userAgent;
      expect(ua, `projeto "${p.name}" sem userAgent`).toBeTruthy();
      expect(ua, `projeto "${p.name}" perdeu o marcador`).toContain(E2E_UA_MARKER);
      expect(isBot(ua), `projeto "${p.name}" não seria tratado como robô`).toBe(true);
    }
  });
});
