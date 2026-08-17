import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CheckoutButton } from "./CheckoutButton";

afterEach(() => vi.restoreAllMocks());

describe("CheckoutButton", () => {
  it("manda a quantidade escolhida no POST", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ checkoutUrl: "https://x" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckoutButton qty={3}>Comprar 3</CheckoutButton>);
    fireEvent.click(screen.getByRole("button", { name: /comprar 3/i }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ kind: "prep_purchase", qty: 3 });
  });
});
