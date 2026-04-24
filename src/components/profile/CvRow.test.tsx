import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CvRow } from "./CvRow";
import type { UnifiedCv } from "@/lib/profile/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const noop = async () => ({ ok: true as const });

const upload: UnifiedCv = {
  origin: "upload",
  id: "u1",
  displayName: "Meu CV.pdf",
  fileName: "Meu CV.pdf",
  sizeBytes: 50_000,
  mimeType: "application/pdf",
  createdAt: "2026-04-20T10:00:00Z",
};

const ai: UnifiedCv = {
  origin: "ai",
  prepSessionId: "p1",
  companyName: "Acme",
  jobTitle: "Engenheiro",
  updatedAt: "2026-04-22T10:00:00Z",
};

describe("<CvRow />", () => {
  it("renderiza chip 'Original' para upload", () => {
    const { getByText } = render(
      <CvRow cv={upload} deleteUpload={noop} rename={noop} deleteAi={noop} />,
    );
    expect(getByText("Original")).toBeInTheDocument();
  });

  it("renderiza chip 'Reescrito pela IA' para ai", () => {
    const { getByText } = render(
      <CvRow cv={ai} deleteUpload={noop} rename={noop} deleteAi={noop} />,
    );
    expect(getByText("Reescrito pela IA")).toBeInTheDocument();
  });

  it("ai não mostra opção 'Renomear'", () => {
    const { getByRole, queryByText } = render(
      <CvRow cv={ai} deleteUpload={noop} rename={noop} deleteAi={noop} />,
    );
    fireEvent.click(getByRole("button", { name: /opções/i }));
    expect(queryByText("Renomear")).toBeNull();
  });

  it("upload mostra 'Renomear' no menu", () => {
    const { getByRole, getByText } = render(
      <CvRow cv={upload} deleteUpload={noop} rename={noop} deleteAi={noop} />,
    );
    fireEvent.click(getByRole("button", { name: /opções/i }));
    expect(getByText("Renomear")).toBeInTheDocument();
  });
});
