import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { UpgradeModal } from "./UpgradeModal";

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

  it("clicar Per-use dispara onCheckout('prep_purchase')", () => {
    const cb = vi.fn();
    const { getByRole } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={cb} />,
    );
    fireEvent.click(getByRole("button", { name: /comprar este prep/i }));
    expect(cb).toHaveBeenCalledWith("prep_purchase");
  });

  it("não renderiza quando open=false", () => {
    const { queryByRole } = render(
      <UpgradeModal open={false} onClose={vi.fn()} onCheckout={vi.fn()} />,
    );
    expect(queryByRole("dialog")).toBeNull();
  });
});
