import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PrepStepper } from "./PrepStepper";

const baseProps = {
  sessionId: "s1",
  currentStep: 3 as const,
  completedSteps: [1, 2] as (1 | 2 | 3 | 4 | 5)[],
};

describe("<PrepStepper />", () => {
  it("renderiza progressbar com aria-valuenow e aria-valuemax=5", () => {
    const { getByRole } = render(<PrepStepper {...baseProps} />);
    const bar = getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemax")).toBe("5");
  });

  it("renderiza 5 segmentos clicáveis (links)", () => {
    const { getAllByTestId, getAllByRole } = render(<PrepStepper {...baseProps} />);
    expect(getAllByTestId(/^stepper-segment-/)).toHaveLength(5);
    expect(getAllByRole("link")).toHaveLength(5);
  });

  it("href de cada segmento aponta pra rota correta", () => {
    const { getAllByRole } = render(<PrepStepper {...baseProps} />);
    const hrefs = getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/prep/s1",
      "/prep/s1/ats",
      "/prep/s1/likely",
      "/prep/s1/deep-dive",
      "/prep/s1/ask",
    ]);
  });

  it("segmento concluído tem classe bg-green-500", () => {
    const { getByTestId } = render(<PrepStepper {...baseProps} />);
    expect(getByTestId("stepper-segment-1").className).toMatch(/bg-green-500/);
    expect(getByTestId("stepper-segment-2").className).toMatch(/bg-green-500/);
  });

  it("segmento atual tem classe bg-orange-500", () => {
    const { getByTestId } = render(<PrepStepper {...baseProps} />);
    expect(getByTestId("stepper-segment-3").className).toMatch(/bg-orange-500/);
  });

  it("segmento futuro tem classe bg-line", () => {
    const { getByTestId } = render(<PrepStepper {...baseProps} />);
    expect(getByTestId("stepper-segment-4").className).toMatch(/bg-line/);
    expect(getByTestId("stepper-segment-5").className).toMatch(/bg-line/);
  });

  it("renderiza label da etapa atual como texto mobile-only", () => {
    const { getByTestId } = render(<PrepStepper {...baseProps} />);
    expect(getByTestId("stepper-mobile-label").textContent).toContain("Etapa 3 de 5");
    expect(getByTestId("stepper-mobile-label").textContent).toContain("Básicas");
  });

  it("link da etapa atual tem aria-current='step'", () => {
    const { getAllByRole } = render(<PrepStepper {...baseProps} />);
    const links = getAllByRole("link");
    expect(links[2].getAttribute("aria-current")).toBe("step");
    expect(links[0].getAttribute("aria-current")).toBeNull();
  });
});
