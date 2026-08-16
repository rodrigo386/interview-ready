import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StepNotGenerated } from "./StepNotGenerated";

describe("<StepNotGenerated />", () => {
  it("explica que a etapa ainda não foi gerada", () => {
    const { getByText } = render(<StepNotGenerated sessionId="s1" />);
    expect(getByText(/ainda não foi gerada/i)).toBeDefined();
  });

  it("oferece link de volta pra etapa 2 (ATS) da sessão certa", () => {
    const { getByRole } = render(<StepNotGenerated sessionId="s1" />);
    const link = getByRole("link");
    expect(link.getAttribute("href")).toBe("/prep/s1/ats");
  });
});
