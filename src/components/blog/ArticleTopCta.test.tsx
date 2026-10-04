import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArticleTopCta } from "./ArticleTopCta";

describe("ArticleTopCta", () => {
  it("leva pra ferramenta grátis, marcado pro funil, sem prometer cadastro", () => {
    render(<ArticleTopCta />);
    const link = screen.getByRole("link", { name: /analisar grátis/i });
    expect(link).toHaveAttribute("href", "/analise-ats-gratis");
    expect(link).toHaveAttribute("data-analytics-cta", "article_top");
    expect(screen.getByText(/sem cadastro/i)).toBeInTheDocument();
  });
});
