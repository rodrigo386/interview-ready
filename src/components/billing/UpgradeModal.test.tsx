import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { UpgradeModal } from "./UpgradeModal";

describe("<UpgradeModal />", () => {
  it("renderiza dois CTAs com valores corretos", () => {
    const { getByText } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={vi.fn()} />,
    );
    expect(getByText(/R\$\s*30/)).toBeInTheDocument();
    expect(getByText(/R\$\s*10/)).toBeInTheDocument();
  });

  it("clicar Pro dispara onCheckout('pro_subscription')", () => {
    const cb = vi.fn();
    const { getByRole } = render(
      <UpgradeModal open onClose={vi.fn()} onCheckout={cb} />,
    );
    fireEvent.click(getByRole("button", { name: /assinar pro/i }));
    expect(cb).toHaveBeenCalledWith("pro_subscription");
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
