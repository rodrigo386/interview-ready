import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CheckoutButton } from "./CheckoutButton";
import { track } from "@/lib/analytics/client";

vi.mock("@/lib/analytics/client", () => ({ track: vi.fn() }));

beforeEach(() => vi.mocked(track).mockClear());
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

  it("emite checkout_iniciado com qty e cents do SKU antes do POST (Task 9)", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ checkoutUrl: "https://x" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckoutButton qty={3}>Comprar 3</CheckoutButton>);
    fireEvent.click(screen.getByRole("button", { name: /comprar 3/i }));

    // O evento sai síncrono no onClick, antes do fetch resolver.
    expect(track).toHaveBeenCalledWith("checkout_iniciado", { qty: 3, cents: 2500 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("emite checkout_iniciado exatamente uma vez mesmo quando o fluxo reenvia por 422 (Task 9)", async () => {
    // Simula o retry de useCheckoutFlow: 1ª resposta 422 cpf_required, mas
    // como o teste não preenche o dialog de CPF, o fluxo fica pendurado
    // esperando o resolver — o que já basta pra provar que o clique (e não
    // o POST) é o gatilho do evento, e que ele não repete por tentativa.
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 422,
      clone: () => ({ json: async () => ({ error: "cpf_required" }) }),
      json: async () => ({ error: "cpf_required" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<CheckoutButton qty={1}>Comprar 1</CheckoutButton>);
    fireEvent.click(screen.getByRole("button", { name: /comprar 1/i }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // `track` também recebe "checkout_started" (evento genérico do
    // useCheckoutFlow) — filtramos só as chamadas de "checkout_iniciado"
    // pra provar que ESTE evento específico não repete por tentativa 422.
    const iniciadoCalls = vi
      .mocked(track)
      .mock.calls.filter(([event]) => event === "checkout_iniciado");
    expect(iniciadoCalls).toEqual([["checkout_iniciado", { qty: 1, cents: 1000 }]]);
  });
});
