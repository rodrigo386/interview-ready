import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { UpgradeModal } from "./UpgradeModal";
import { track } from "@/lib/analytics/client";

vi.mock("@/lib/analytics/client", () => ({ track: vi.fn() }));

beforeEach(() => vi.mocked(track).mockClear());

describe("<UpgradeModal />", () => {
  it("renderiza o preço avulso e o link de pacotes", () => {
    const { getByText } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={vi.fn()} />,
    );
    expect(getByText(/R\$\s*10/)).toBeInTheDocument();
    expect(getByText(/3 por R\$\s*25/)).toBeInTheDocument();
  });

  it("CTA de pacotes vai pra /pricing", () => {
    const { getByRole } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={vi.fn()} />,
    );
    const link = getByRole("link", { name: /ver pacotes/i });
    expect(link.getAttribute("href")).toBe("/pricing");
  });

  it("clicar Per-use dispara onCheckout('prep_purchase', 1)", () => {
    const cb = vi.fn();
    const { getByRole } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={cb} />,
    );
    fireEvent.click(getByRole("button", { name: /comprar este prep/i }));
    expect(cb).toHaveBeenCalledWith("prep_purchase", 1);
  });

  it("emite checkout_iniciado com a MESMA quantidade que manda pro checkout", () => {
    // O modal é o paywall de verdade (GenerateFullPrepCta, NewPrepForm,
    // PrepFailed) e antes chamava `checkout.start()` sem emitir nada,
    // enquanto o webhook emite `checkout_confirmado` pra toda compra.
    const cb = vi.fn();
    const { getByRole } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={cb} />,
    );
    fireEvent.click(getByRole("button", { name: /comprar este prep/i }));

    expect(track).toHaveBeenCalledWith("checkout_iniciado", {
      qty: 1,
      cents: 1000,
    });
    // Evento e cobrança precisam falar da mesma compra.
    const trackedQty = vi.mocked(track).mock.calls.find(
      (c) => c[0] === "checkout_iniciado",
    )?.[1] as { qty: number };
    expect(cb.mock.calls[0][1]).toBe(trackedQty.qty);
  });

  it("emite checkout_iniciado uma vez por intenção — o botão trava depois do clique", () => {
    const { getByRole } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={vi.fn()} />,
    );
    const button = getByRole("button", { name: /comprar este prep/i });
    fireEvent.click(button);
    fireEvent.click(button);

    const starts = vi
      .mocked(track)
      .mock.calls.filter((c) => c[0] === "checkout_iniciado");
    expect(starts).toHaveLength(1);
  });

  it("não renderiza quando open=false", () => {
    const { queryByRole } = render(
      <UpgradeModal open={false} onClose={vi.fn()} onCheckout={vi.fn()} />,
    );
    expect(queryByRole("dialog")).toBeNull();
  });
});
