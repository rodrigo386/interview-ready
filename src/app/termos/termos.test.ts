import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Os termos são contrato publicado. Quando o comportamento de cobrança muda e
 * o texto não acompanha, o site passa a operar contra o que promete — e isso
 * não quebra nenhum teste de UI nem de tipo.
 *
 * Em 03/09 criar preparação dentro da conta passou a consumir 1 crédito. Os
 * termos diziam textualmente o contrário: "criar a preparação [...] não custa
 * crédito". Este teste existe pra essa divergência doer no CI, não no cliente.
 */
const termos = readFileSync("src/app/termos/page.tsx", "utf8");

describe("termos de uso — coerência com a cobrança", () => {
  it("não afirma mais que criar preparação é de graça", () => {
    expect(termos).not.toMatch(/criar a\s+preparação[^.]*não custam? crédito/i);
  });

  it("diz que o crédito é debitado ao criar a preparação", () => {
    expect(termos).toMatch(/debitado quando você cria uma/i);
  });

  it("preserva a exceção da ferramenta anônima", () => {
    // Quem veio da análise gratuita não pagou nada ainda: pra essa pessoa o
    // débito continua no botão "Gerar preparação completa".
    expect(termos).toMatch(/análise ATS gratuita/i);
    expect(termos).toMatch(/Gerar preparação\s*completa/i);
  });

  it("continua prometendo devolução em falha e entrega parcial", () => {
    expect(termos).toMatch(/Falha na geração/i);
    expect(termos).toMatch(/Entrega parcial/i);
  });
});
