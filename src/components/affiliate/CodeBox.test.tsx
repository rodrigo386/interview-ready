import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CodeBox } from "./CodeBox";

describe("<CodeBox />", () => {
  it("renders the affiliate URL with code", () => {
    const { getByText } = render(<CodeBox code="ANA-COACH" />);
    expect(getByText(/prepavaga\.com\.br\/\?ref=ANA-COACH/)).toBeInTheDocument();
  });

  it("calls clipboard.writeText on Copiar click", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { getByRole } = render(<CodeBox code="ANA-COACH" />);
    fireEvent.click(getByRole("button", { name: /copiar/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(writeText).toHaveBeenCalledWith(
      "https://prepavaga.com.br/?ref=ANA-COACH",
    );
  });
});
