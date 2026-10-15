import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { PageViewTracker } from "./PageViewTracker";

const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

function definirWebdriver(valor: boolean | undefined) {
  Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => valor });
}

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  definirWebdriver(undefined);
});

function corpoEnviado() {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return { url, body: JSON.parse(String(init.body)) };
}

describe("<PageViewTracker />", () => {
  it("avisa o servidor quando o navegador é controlado por automação", () => {
    definirWebdriver(true);
    render(<PageViewTracker />);
    const { url, body } = corpoEnviado();
    expect(url).toBe("/api/track");
    expect(body.automated).toBe(true);
  });

  it("navegador de pessoa vai com automated=false", () => {
    definirWebdriver(false);
    render(<PageViewTracker />);
    expect(corpoEnviado().body.automated).toBe(false);
  });

  it("navegador sem a propriedade (undefined) também conta como pessoa", () => {
    definirWebdriver(undefined);
    render(<PageViewTracker />);
    expect(corpoEnviado().body.automated).toBe(false);
  });
});
