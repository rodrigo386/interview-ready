import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Chip } from "./Chip";

describe("<Chip />", () => {
  it("renderiza children", () => {
    const { getByText } = render(<Chip>Hello</Chip>);
    expect(getByText("Hello")).toBeDefined();
  });
  it("variant default usa fundo --bg + borda --line", () => {
    const { container } = render(<Chip>x</Chip>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/border-line/);
    expect(el.className).toMatch(/bg-bg/);
  });
  it("variant orange usa fundo --orange-soft + texto --orange-700", () => {
    const { container } = render(<Chip variant="orange">x</Chip>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/bg-orange-soft/);
    expect(el.className).toMatch(/text-orange-700/);
  });
});
