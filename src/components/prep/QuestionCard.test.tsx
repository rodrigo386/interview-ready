import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { QuestionCard } from "./QuestionCard";

const baseProps = {
  questionNumber: "01 / 03" as const,
  title: "Conta uma vez que você liderou um projeto difícil.",
  sections: [
    { heading: "💡 O que querem ouvir", body: <p>blah</p> },
  ],
  onNext: vi.fn(),
};

describe("<QuestionCard />", () => {
  it("renderiza title, questionNumber e section heading", () => {
    const { getByText } = render(<QuestionCard accent="orange" {...baseProps} />);
    expect(getByText("#01 / 03")).toBeDefined();
    expect(getByText(baseProps.title)).toBeDefined();
    expect(getByText("💡 O que querem ouvir")).toBeDefined();
  });

  it("accent='orange' aplica classe text-orange-700 no heading", () => {
    const { getByText } = render(<QuestionCard accent="orange" {...baseProps} />);
    expect(getByText("💡 O que querem ouvir").className).toMatch(/text-orange-700/);
  });

  it("accent='yellow' aplica classe text-yellow-700 no heading", () => {
    const { getByText } = render(<QuestionCard accent="yellow" {...baseProps} />);
    expect(getByText("💡 O que querem ouvir").className).toMatch(/text-yellow-700/);
  });

  it("accent='green' aplica classe text-green-700 no heading", () => {
    const { getByText } = render(<QuestionCard accent="green" {...baseProps} />);
    expect(getByText("💡 O que querem ouvir").className).toMatch(/text-green-700/);
  });

  it("onNext dispara ao clicar no CTA", () => {
    const onNext = vi.fn();
    const { getByText } = render(
      <QuestionCard accent="orange" {...baseProps} onNext={onNext} ctaLabel="Próxima →" />,
    );
    fireEvent.click(getByText("Próxima →"));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("seta esquerda fica disabled quando onPrev não é passado", () => {
    const { getByLabelText } = render(<QuestionCard accent="orange" {...baseProps} />);
    expect((getByLabelText("Pergunta anterior") as HTMLButtonElement).disabled).toBe(true);
  });

  it("renderiza chips quando passados", () => {
    const { getByText } = render(
      <QuestionCard accent="orange" {...baseProps} chips={["Liderança", "Stakeholders"]} />,
    );
    expect(getByText("Liderança")).toBeDefined();
    expect(getByText("Stakeholders")).toBeDefined();
  });
});
