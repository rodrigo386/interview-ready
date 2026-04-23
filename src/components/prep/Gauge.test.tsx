import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Gauge, gaugeColor } from "./Gauge";

describe("gaugeColor", () => {
  it("0..40 → red", () => {
    expect(gaugeColor(0)).toBe("var(--prep-red)");
    expect(gaugeColor(40)).toBe("var(--prep-red)");
  });
  it("41..70 → yellow", () => {
    expect(gaugeColor(41)).toBe("var(--prep-yellow)");
    expect(gaugeColor(70)).toBe("var(--prep-yellow)");
  });
  it("71..100 → green", () => {
    expect(gaugeColor(71)).toBe("var(--prep-green)");
    expect(gaugeColor(100)).toBe("var(--prep-green)");
  });
});

describe("<Gauge />", () => {
  it("aplica role='meter' com aria-valuenow", () => {
    const { getByRole } = render(<Gauge value={42} />);
    const meter = getByRole("meter");
    expect(meter.getAttribute("aria-valuenow")).toBe("42");
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
  });

  it("renderiza número central e label DE 100", () => {
    const { getByText } = render(<Gauge value={73} />);
    expect(getByText("73")).toBeDefined();
    expect(getByText("DE 100")).toBeDefined();
  });
});
