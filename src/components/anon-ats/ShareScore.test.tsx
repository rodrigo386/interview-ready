import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const track = vi.fn();
vi.mock("@/lib/analytics/client", () => ({ track: (...a: unknown[]) => track(...a) }));

import { ShareScore, montarCompartilhamento } from "./ShareScore";

describe("montarCompartilhamento", () => {
  it("leva só a nota e aponta pra home com UTMs, nunca pra página de resultado", () => {
    const c = montarCompartilhamento(8, "https://prepavaga.com.br");
    expect(c.texto).toContain("8/100");
    expect(c.link).toBe(
      "https://prepavaga.com.br/?utm_source=share&utm_medium=score&utm_campaign=ats_resultado",
    );
    expect(c.link).not.toContain("resultado/");
    expect(decodeURIComponent(c.whatsapp)).toContain(c.link);
  });
});

describe("<ShareScore />", () => {
  beforeEach(() => track.mockClear());

  it("dispara score_share ao clicar no WhatsApp", () => {
    render(<ShareScore score={42} />);
    fireEvent.click(screen.getByRole("link", { name: /whatsapp/i }));
    expect(track).toHaveBeenCalledWith("score_share", { channel: "whatsapp", score: 42 });
  });

  it("copia a mensagem e dispara score_share", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ShareScore score={42} />);
    fireEvent.click(screen.getByRole("button", { name: /copiar/i }));
    await screen.findByText(/copiado/i);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("42/100"));
    expect(track).toHaveBeenCalledWith("score_share", { channel: "copiar", score: 42 });
  });
});
