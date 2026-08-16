import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StepNotGenerated } from "./StepNotGenerated";

describe("<StepNotGenerated />", () => {
  it("explica que a etapa ainda não foi gerada", () => {
    const { getByText } = render(<StepNotGenerated sessionId="s1" />);
    expect(getByText(/ainda não foi gerada/i)).toBeDefined();
  });

  it("oferece link de volta pra etapa 2 (ATS) da sessão certa", () => {
    const { getByRole } = render(<StepNotGenerated sessionId="s1" />);
    const link = getByRole("link");
    expect(link.getAttribute("href")).toBe("/prep/s1/ats");
  });

  it("expõe o botão que de fato gera a preparação completa", () => {
    // Regressão: a copy antiga mandava "gere a preparação completa a partir
    // da etapa 2", onde não existia botão nenhum pra isso — beco sem saída.
    const { getByRole } = render(<StepNotGenerated sessionId="s1" />);
    expect(
      getByRole("button", { name: /gerar preparação completa/i }),
    ).toBeDefined();
  });
});
