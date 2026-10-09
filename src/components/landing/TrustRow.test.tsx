import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TrustRow } from "./TrustRow";

describe("<TrustRow />", () => {
  it("diz o que acontece com o currículo, com as afirmações da política de privacidade", () => {
    render(<TrustRow />);
    const lista = screen.getByRole("list", { name: /como tratamos o seu currículo/i });
    const itens = within(lista).getAllByRole("listitem").map((li) => li.textContent ?? "");

    expect(itens).toHaveLength(4);
    expect(itens.join(" ")).toMatch(/7 dias/); // retenção da análise anônima
    expect(itens.join(" ")).toMatch(/não vendemos seus dados nem treinamos IA/i);
    expect(itens.join(" ")).toMatch(/Google/); // quem processa faz parte da confiança
    expect(itens.join(" ")).toMatch(/Estados Unidos/);
    expect(itens.join(" ")).toMatch(/reembolso/i);
  });

  it("linka a política de privacidade e a LGPD", () => {
    render(<TrustRow />);
    expect(screen.getByRole("link", { name: /política de privacidade/i })).toHaveAttribute("href", "/privacidade");
    expect(screen.getByRole("link", { name: /direitos na lgpd/i })).toHaveAttribute("href", "/lgpd");
  });

  it("os ícones são decorativos", () => {
    const { container } = render(<TrustRow />);
    const icones = container.querySelectorAll("li > span[aria-hidden]");
    expect(icones).toHaveLength(4);
  });
});
