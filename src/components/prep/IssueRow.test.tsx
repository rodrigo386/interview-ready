import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { IssueRow } from "./IssueRow";

describe("<IssueRow />", () => {
  it("renderiza number, title, description e impact", () => {
    const { getByText } = render(
      <IssueRow severity="critical" number={1} title="Falta X" description="Detalhe" impact="+22 pts" />,
    );
    expect(getByText("1")).toBeDefined();
    expect(getByText("Falta X")).toBeDefined();
    expect(getByText("Detalhe")).toBeDefined();
    expect(getByText("+22 pts")).toBeDefined();
  });

  it("severity='critical' usa bg-red-soft no número", () => {
    const { getByTestId } = render(
      <IssueRow severity="critical" number={1} title="t" description="d" impact="+1" />,
    );
    expect(getByTestId("issue-number").className).toMatch(/bg-red-soft/);
  });

  it("severity='warning' usa bg-yellow-soft no número", () => {
    const { getByTestId } = render(
      <IssueRow severity="warning" number={2} title="t" description="d" impact="+1" />,
    );
    expect(getByTestId("issue-number").className).toMatch(/bg-yellow-soft/);
  });

  it("aria-label inclui severidade, título e impacto", () => {
    const { getByRole } = render(
      <IssueRow severity="critical" number={1} title="Falta X" description="d" impact="+22 pts" />,
    );
    expect(getByRole("listitem").getAttribute("aria-label")).toContain("Ajuste crítico");
    expect(getByRole("listitem").getAttribute("aria-label")).toContain("Falta X");
    expect(getByRole("listitem").getAttribute("aria-label")).toContain("+22 pts");
  });
});
