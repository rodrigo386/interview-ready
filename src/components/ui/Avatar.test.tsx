import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("<Avatar />", () => {
  it("renderiza img com src e alt", () => {
    const { getByRole } = render(
      <Avatar src="https://example.com/a.jpg" alt="Foto de Foo" size={48} />,
    );
    const img = getByRole("img") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/a.jpg");
    expect(img.alt).toBe("Foto de Foo");
  });

  it("aplica size em width e height", () => {
    const { getByRole } = render(
      <Avatar src="https://example.com/a.jpg" alt="x" size={96} />,
    );
    const img = getByRole("img") as HTMLImageElement;
    expect(img.width).toBe(96);
    expect(img.height).toBe(96);
  });

  it("é circular (rounded-full)", () => {
    const { getByRole } = render(
      <Avatar src="https://example.com/a.jpg" alt="x" size={48} />,
    );
    expect(getByRole("img").className).toMatch(/rounded-full/);
  });
});
