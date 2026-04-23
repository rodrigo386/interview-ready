import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PrepStepper } from "./PrepStepper";

describe("<PrepStepper />", () => {
  it("renderiza progressbar com aria-valuenow e aria-valuemax=5", () => {
    const { getByRole } = render(<PrepStepper currentStep={3} completedSteps={[1, 2]} />);
    const bar = getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemax")).toBe("5");
  });

  it("renderiza 5 segmentos", () => {
    const { getAllByTestId } = render(
      <PrepStepper currentStep={3} completedSteps={[1, 2]} />,
    );
    expect(getAllByTestId(/^stepper-segment-/)).toHaveLength(5);
  });

  it("segmento concluído tem classe bg-green-500", () => {
    const { getByTestId } = render(<PrepStepper currentStep={3} completedSteps={[1, 2]} />);
    expect(getByTestId("stepper-segment-1").className).toMatch(/bg-green-500/);
    expect(getByTestId("stepper-segment-2").className).toMatch(/bg-green-500/);
  });

  it("segmento atual tem classe bg-orange-500", () => {
    const { getByTestId } = render(<PrepStepper currentStep={3} completedSteps={[1, 2]} />);
    expect(getByTestId("stepper-segment-3").className).toMatch(/bg-orange-500/);
  });

  it("segmento futuro tem classe bg-line", () => {
    const { getByTestId } = render(<PrepStepper currentStep={3} completedSteps={[1, 2]} />);
    expect(getByTestId("stepper-segment-4").className).toMatch(/bg-line/);
    expect(getByTestId("stepper-segment-5").className).toMatch(/bg-line/);
  });

  it("renderiza label da etapa atual como texto mobile-only", () => {
    const { getByTestId } = render(<PrepStepper currentStep={3} completedSteps={[1, 2]} />);
    expect(getByTestId("stepper-mobile-label").textContent).toContain("Etapa 3 de 5");
    expect(getByTestId("stepper-mobile-label").textContent).toContain("Básicas");
  });
});
