import { describe, it, expect } from "vitest";
import { toBrazilDay, ultimosDiasBrasil } from "./brazil-day";

describe("toBrazilDay", () => {
  it("o caso que motivou o conserto: 23h de Brasília ainda é o mesmo dia", () => {
    // 2026-09-04T02:46Z é 2026-09-03T23:46 em São Paulo. O recorte UTC
    // jogava essa atividade na barra do dia 4.
    expect(toBrazilDay("2026-09-04T02:46:53Z")).toBe("2026-09-03");
  });

  it("21h de Brasília — início da faixa que o UTC empurrava pra frente", () => {
    expect(toBrazilDay("2026-09-04T00:00:00Z")).toBe("2026-09-03");
  });

  it("meia-noite e um em Brasília já é o dia novo", () => {
    expect(toBrazilDay("2026-09-04T03:01:00Z")).toBe("2026-09-04");
  });

  it("meio-dia não muda de dia em nenhum dos dois fusos", () => {
    expect(toBrazilDay("2026-09-03T15:00:00Z")).toBe("2026-09-03");
  });

  it("data inválida devolve string vazia em vez de 'Invalid Date'", () => {
    // Chave de bucket com "Invalid Date" viraria uma barra fantasma no
    // gráfico em vez de simplesmente não bater com bucket nenhum.
    expect(toBrazilDay("lixo")).toBe("");
  });
});

describe("ultimosDiasBrasil", () => {
  const agora = new Date("2026-09-04T02:46:53Z").getTime(); // 03/09 23h46 BR

  it("termina no dia brasileiro corrente, não no UTC", () => {
    const dias = ultimosDiasBrasil(3, agora);
    expect(dias[dias.length - 1]).toBe("2026-09-03");
  });

  it("devolve a quantidade pedida, em ordem crescente", () => {
    expect(ultimosDiasBrasil(3, agora)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
  });

  it("um dia só é só hoje", () => {
    expect(ultimosDiasBrasil(1, agora)).toEqual(["2026-09-03"]);
  });
});
