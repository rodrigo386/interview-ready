import { describe, it, expect } from "vitest";
import { PREP_SKUS, findSku, brlLabel } from "./prices";

describe("PREP_SKUS", () => {
  it("tem os três pacotes com os preços da spec", () => {
    expect(PREP_SKUS.map((s) => [s.qty, s.cents])).toEqual([[1, 1000], [3, 2500], [5, 4000]]);
  });

  it("findSku acha por quantidade", () => {
    expect(findSku(3)).toEqual({ qty: 3, cents: 2500 });
  });

  it("findSku devolve null pra quantidade inexistente", () => {
    expect(findSku(4)).toBeNull();
  });

  it("o desconto cresce com o pacote", () => {
    const unit = (s: { qty: number; cents: number }) => s.cents / s.qty;
    expect(unit(PREP_SKUS[1])).toBeLessThan(unit(PREP_SKUS[0]));
    expect(unit(PREP_SKUS[2])).toBeLessThan(unit(PREP_SKUS[1]));
  });

  it("formata em BRL", () => {
    const formatted = brlLabel(2500);
    expect(formatted.replace(/\s/g, " ")).toBe("R$ 25,00");
  });
});
