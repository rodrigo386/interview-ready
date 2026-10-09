import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const setStatus = vi.fn();
vi.mock("@/app/(app)/dashboard/status-actions", () => ({
  setApplicationStatus: (...a: unknown[]) => setStatus(...a),
}));

import { ApplicationStatusSelect } from "./ApplicationStatusSelect";

beforeEach(() => setStatus.mockReset());

function montar(initial: "preparando" | "candidatei" = "preparando") {
  return render(<ApplicationStatusSelect sessionId="s1" companyName="Zaffari" initial={initial} />);
}

describe("<ApplicationStatusSelect />", () => {
  it("mostra os 5 status em português, com o inicial selecionado, e nomeia a empresa pra leitor de tela", () => {
    montar("candidatei");
    const sel = screen.getByRole("combobox", { name: /status da candidatura em zaffari/i }) as HTMLSelectElement;
    expect(sel.value).toBe("candidatei");
    expect(Array.from(sel.options).map((o) => o.textContent)).toEqual([
      "Preparando",
      "Já me candidatei",
      "Entrevista marcada",
      "Recebi proposta",
      "Encerrada",
    ]);
  });

  it("ao mudar, grava (id, status) e mantém o valor", async () => {
    setStatus.mockResolvedValue({ ok: true });
    montar();
    const sel = screen.getByRole("combobox") as HTMLSelectElement;
    await act(async () => { fireEvent.change(sel, { target: { value: "entrevista" } }); });
    expect(setStatus).toHaveBeenCalledWith("s1", "entrevista");
    expect(sel.value).toBe("entrevista");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("se a gravação falha, volta ao valor anterior e avisa", async () => {
    setStatus.mockResolvedValue({ ok: false, error: "failed" });
    montar("candidatei");
    const sel = screen.getByRole("combobox") as HTMLSelectElement;
    await act(async () => { fireEvent.change(sel, { target: { value: "oferta" } }); });
    await waitFor(() => expect(sel.value).toBe("candidatei"));
    expect(screen.getByRole("alert")).toHaveTextContent(/não foi possível salvar/i);
  });

  it("escolher o mesmo valor não chama o servidor", async () => {
    montar();
    await act(async () => { fireEvent.change(screen.getByRole("combobox"), { target: { value: "preparando" } }); });
    expect(setStatus).not.toHaveBeenCalled();
  });
});
