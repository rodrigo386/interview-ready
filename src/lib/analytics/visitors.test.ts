import { describe, it, expect } from "vitest";
import {
  buildSightingIndex,
  isConfirmedVisitor,
  summarizeWindow,
  type VisitorRow,
} from "./visitors";

const HORA = 60 * 60 * 1000;
const AGORA = new Date("2026-08-26T12:00:00Z").getTime();
const em = (hAtras: number) => new Date(AGORA - hAtras * HORA).toISOString();

const linha = (visitor_id: string, hAtras: number): VisitorRow => ({
  visitor_id,
  created_at: em(hAtras),
});

describe("buildSightingIndex", () => {
  it("conta avistamentos por visitante", () => {
    const idx = buildSightingIndex([linha("a", 1), linha("a", 2), linha("b", 1)]);
    expect(idx.get("a")).toBe(2);
    expect(idx.get("b")).toBe(1);
  });

  it("visitante desconhecido não é confirmado", () => {
    expect(isConfirmedVisitor("fantasma", new Map())).toBe(false);
  });
});

describe("summarizeWindow", () => {
  it("a varredura que inflou a semana de 17/08 não vira gente", () => {
    // 17 ids distintos, uma view cada — cookie descartado a cada requisição.
    const varredura = Array.from({ length: 17 }, (_, i) => linha(`sweep-${i}`, 3));
    // Duas pessoas reais navegando.
    const humanos = [
      linha("pessoa-1", 3),
      linha("pessoa-1", 2),
      linha("pessoa-2", 5),
      linha("pessoa-2", 1),
    ];
    const rows = [...varredura, ...humanos];
    const r = summarizeWindow(rows, buildSightingIndex(rows), AGORA - 24 * HORA);

    expect(r.visitors).toBe(19); // o número antigo, inflado
    expect(r.confirmed).toBe(2); // o piso real
    expect(r.unconfirmed).toBe(17);
    expect(r.views).toBe(21);
  });

  it("confirma por reaparecimento GLOBAL, não dentro da janela", () => {
    // Visitou há 40h e voltou há 2h: a janela de 24h vê só a segunda visita,
    // mas o cookie está provado. Contar só dentro da janela marcaria essa
    // pessoa como não confirmada por acidente de recorte.
    const rows = [linha("volta", 40), linha("volta", 2)];
    const r = summarizeWindow(rows, buildSightingIndex(rows), AGORA - 24 * HORA);
    expect(r.visitors).toBe(1);
    expect(r.confirmed).toBe(1);
    expect(r.views).toBe(1); // só uma view caiu na janela
  });

  it("bounce humano legítimo fica como não confirmado — e isso é honesto", () => {
    // O método não distingue varredura de pessoa que leu um artigo e saiu.
    // Por isso `unconfirmed` nunca deve ser rotulado como "bot".
    const rows = [linha("leitor", 1)];
    const r = summarizeWindow(rows, buildSightingIndex(rows), AGORA - 24 * HORA);
    expect(r.confirmed).toBe(0);
    expect(r.unconfirmed).toBe(1);
  });

  it("cutoff null = desde sempre", () => {
    const rows = [linha("a", 1000), linha("a", 1)];
    const r = summarizeWindow(rows, buildSightingIndex(rows), null);
    expect(r.views).toBe(2);
    expect(r.confirmed).toBe(1);
  });

  it("confirmed + unconfirmed sempre fecha com visitors", () => {
    const rows = [
      linha("a", 1), linha("a", 2), linha("b", 1), linha("c", 3), linha("c", 4),
    ];
    const r = summarizeWindow(rows, buildSightingIndex(rows), AGORA - 24 * HORA);
    expect(r.confirmed + r.unconfirmed).toBe(r.visitors);
  });

  it("data inválida não entra na janela nem quebra a conta", () => {
    const rows: VisitorRow[] = [
      { visitor_id: "x", created_at: "lixo" },
      linha("y", 1),
    ];
    const r = summarizeWindow(rows, buildSightingIndex(rows), AGORA - 24 * HORA);
    expect(r.views).toBe(1);
    expect(r.visitors).toBe(1);
  });

  it("janela vazia devolve zeros, não NaN", () => {
    expect(summarizeWindow([], new Map(), AGORA - HORA)).toEqual({
      views: 0, visitors: 0, confirmed: 0, unconfirmed: 0,
    });
  });
});
