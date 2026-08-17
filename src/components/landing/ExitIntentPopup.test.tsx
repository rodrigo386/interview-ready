import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ExitIntentPopup } from "./ExitIntentPopup";

/**
 * O popup só existe no DOM depois de armar (8s de permanência) e de um
 * mouseout que saia pelo topo da viewport. Este helper reproduz os dois
 * passos — sem ele todo teste aqui olharia pra um `null`.
 */
function abrirPopup() {
  render(<ExitIntentPopup />);
  act(() => {
    vi.advanceTimersByTime(8000);
  });
  fireEvent.mouseOut(document, { relatedTarget: null, clientY: 0 });
}

describe("ExitIntentPopup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("manda pra ferramenta anônima, não pro cadastro", () => {
    // Este é o ponto do componente. É o momento de menor intenção do funil
    // (a pessoa está saindo) — pedir cadastro aqui é a fricção que a
    // ferramenta anônima existe pra remover.
    abrirPopup();
    const cta = screen.getByRole("link", { name: /analisar meu currículo grátis/i });
    expect(cta).toHaveAttribute("href", "/analise-ats-gratis");
    expect(screen.queryByRole("link", { name: /criar conta/i })).not.toBeInTheDocument();
  });

  it("não promete um campo de link que o formulário anônimo não tem", () => {
    // `fetchJdFromUrl` é action autenticada; a tela anônima só aceita o texto
    // colado da vaga. A cópia antiga dizia "cola o link de uma vaga".
    abrirPopup();
    expect(screen.getByText(/cola o texto da vaga/i)).toBeInTheDocument();
    expect(screen.queryByText(/cola o link/i)).not.toBeInTheDocument();
  });

  it("diz que não precisa de cadastro — é o que mudou de fato", () => {
    abrirPopup();
    expect(screen.getByText(/sem cadastro e sem cartão/i)).toBeInTheDocument();
  });

  it("mantém o preço da preparação completa visível", () => {
    abrirPopup();
    expect(screen.getByText(/R\$10/)).toBeInTheDocument();
  });

  it("não aparece antes dos 8s de permanência", () => {
    render(<ExitIntentPopup />);
    act(() => {
      vi.advanceTimersByTime(7999);
    });
    fireEvent.mouseOut(document, { relatedTarget: null, clientY: 0 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignora saída que não seja pelo topo", () => {
    render(<ExitIntentPopup />);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    fireEvent.mouseOut(document, { relatedTarget: null, clientY: 400 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("não reaparece dentro de uma semana", () => {
    localStorage.setItem("pv_exit_popup_shown_at", String(Date.now()));
    render(<ExitIntentPopup />);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    fireEvent.mouseOut(document, { relatedTarget: null, clientY: 0 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
