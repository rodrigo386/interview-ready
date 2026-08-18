import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DossiePitch } from "./DossiePitch";
import { DOSSIE_INCLUI } from "@/lib/billing/dossie";

describe("<DossiePitch />", () => {
  it("diz o preço na página onde a pessoa acabou de ver o score", () => {
    // O buraco que originou o componente: a página de resultado da análise
    // grátis não mencionava dossiê nem preço em lugar nenhum, e a única
    // página que explicava o produto pago era a home — que parte do tráfego
    // dessa ferramenta nunca carrega.
    const { getByText } = render(<DossiePitch />);
    expect(getByText(/custa R\$10/i)).toBeDefined();
  });

  it("lista tudo que o crédito destrava, sem divergir da landing", () => {
    const { getByText } = render(<DossiePitch />);
    for (const item of DOSSIE_INCLUI) {
      expect(getByText(item)).toBeDefined();
    }
  });

  it("manda para o cadastro, não para o checkout", () => {
    // Cobrar antes de existir conta exigiria CPF e cliente no Asaas sem
    // usuário. O que muda é a pessoa saber o preço antes de se cadastrar.
    const { getByRole } = render(<DossiePitch />);
    expect(getByRole("link").getAttribute("href")).toBe("/signup");
  });
});
