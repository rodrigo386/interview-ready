import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { GenerateFullPrepCta } from "./GenerateFullPrepCta";
import { PrepShellProvider } from "./PrepShellProvider";

function comSaldo(prepCredits: number) {
  return render(
    <PrepShellProvider
      sessionId="s1"
      company="TechCorp"
      role="Gerente de Operações"
      estimatedMinutes={null}
      serverCompleted={[]}
      prepCredits={prepCredits}
    >
      <GenerateFullPrepCta sessionId="s1" />
    </PrepShellProvider>,
  );
}

describe("<GenerateFullPrepCta />", () => {
  it("mostra o preço no botão quando o saldo é zero", () => {
    // Análise de funil de 18/08/2026: as duas pessoas que criaram conta pela
    // ferramenta grátis pararam aqui. O rótulo antigo ("usa 1 preparação da
    // sua conta") descrevia um recurso que elas tinham zero, e o custo só
    // aparecia depois do clique, na forma de um paywall.
    const { getByRole, getByText } = comSaldo(0);

    expect(
      getByRole("button", { name: /gerar preparação completa · R\$10/i }),
    ).toBeDefined();
    expect(getByText(/Custa R\$10/)).toBeDefined();
  });

  it("não cobra de quem já tem crédito, e diz quantos sobram", () => {
    const { getByRole, getByText, queryByText } = comSaldo(2);

    expect(
      getByRole("button", { name: /^Gerar preparação completa →$/ }),
    ).toBeDefined();
    expect(getByText(/Usa 1 das suas 2 preparações/)).toBeDefined();
    expect(queryByText(/Custa R\$10/)).toBeNull();
  });

  it("fora do shell, cai no comportamento neutro em vez de quebrar", () => {
    // O saldo é desconhecido: submeter e deixar a action decidir é melhor do
    // que anunciar um preço para quem talvez já tenha pago.
    const { getByRole, queryByText } = render(
      <GenerateFullPrepCta sessionId="s1" />,
    );

    expect(
      getByRole("button", { name: /gerar preparação completa/i }),
    ).toBeDefined();
    expect(queryByText(/Custa R\$10/)).toBeNull();
  });
});
