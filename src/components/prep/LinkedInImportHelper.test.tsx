import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LinkedInImportHelper } from "./LinkedInImportHelper";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("<LinkedInImportHelper />", () => {
  beforeEach(() => {
    mockMatchMedia(false); // default: desktop viewport
  });

  it("renders collapsed by default", () => {
    const { getByRole, queryByText } = render(<LinkedInImportHelper />);
    const toggle = getByRole("button", { name: /importar do linkedin/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(queryByText(/abrir meu linkedin/i)).toBeNull();
    expect(queryByText(/recursos.*salvar como pdf/i)).toBeNull();
  });

  it("expands on click revealing the 3 steps (desktop copy)", () => {
    const { getByRole, getByText } = render(<LinkedInImportHelper />);
    const toggle = getByRole("button", { name: /importar do linkedin/i });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(getByText(/abra seu perfil no linkedin/i)).toBeInTheDocument();
    expect(getByText(/canto superior direito.*recursos.*salvar como pdf/i)).toBeInTheDocument();
    expect(getByText(/volte aqui e faça upload/i)).toBeInTheDocument();
  });

  it("LinkedIn link points to /in/me/ and opens in new tab safely", () => {
    const { getByRole } = render(<LinkedInImportHelper />);
    fireEvent.click(getByRole("button", { name: /importar do linkedin/i }));
    const link = getByRole("link", { name: /abrir meu linkedin/i });
    expect(link.getAttribute("href")).toBe("https://www.linkedin.com/in/me/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("collapses again on second click", () => {
    const { getByRole, queryByText } = render(<LinkedInImportHelper />);
    const toggle = getByRole("button", { name: /importar do linkedin/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(queryByText(/abrir meu linkedin/i)).toBeNull();
  });

  it("renders mobile-specific copy when viewport matches mobile media query", () => {
    mockMatchMedia(true);
    const { getByRole, getByText, queryByText } = render(<LinkedInImportHelper />);
    fireEvent.click(getByRole("button", { name: /importar do linkedin/i }));
    expect(getByText(/três pontos.*salvar como pdf/i)).toBeInTheDocument();
    expect(getByText(/se o linkedin abrir no app/i)).toBeInTheDocument();
    expect(queryByText(/canto superior direito.*recursos.*salvar como pdf/i)).toBeNull();
  });
});
