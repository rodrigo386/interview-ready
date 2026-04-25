import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { AvatarEditor } from "./AvatarEditor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const baseProps = {
  userId: "uid-1",
  currentUrl: "https://example.com/a.jpg",
  hasCustomAvatar: false,
  uploadFn: vi.fn(async () => undefined),
  updatePathAction: vi.fn(async () => ({ ok: true as const })),
  removeAction: vi.fn(async () => ({ ok: true as const })),
};

describe("<AvatarEditor />", () => {
  it("rejeita arquivo > 2MB", async () => {
    const { getByLabelText, findByText } = render(<AvatarEditor {...baseProps} />);
    const file = new File([new Uint8Array(2_500_000)], "big.jpg", { type: "image/jpeg" });
    fireEvent.change(getByLabelText(/alterar foto/i), { target: { files: [file] } });
    expect(await findByText(/máximo de 2/i)).toBeInTheDocument();
    expect(baseProps.uploadFn).not.toHaveBeenCalled();
  });

  it("rejeita mime inválido", async () => {
    const { getByLabelText, findByText } = render(<AvatarEditor {...baseProps} />);
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(getByLabelText(/alterar foto/i), { target: { files: [file] } });
    expect(await findByText(/formato/i)).toBeInTheDocument();
  });

  it("chama uploadFn + updatePathAction quando arquivo válido", async () => {
    const uploadFn = vi.fn(async () => undefined);
    const updatePathAction = vi.fn(async () => ({ ok: true as const }));
    const { getByLabelText } = render(
      <AvatarEditor {...baseProps} uploadFn={uploadFn} updatePathAction={updatePathAction} />,
    );
    const file = new File(["x"], "ok.png", { type: "image/png" });
    fireEvent.change(getByLabelText(/alterar foto/i), { target: { files: [file] } });
    await waitFor(() => expect(uploadFn).toHaveBeenCalled());
    await waitFor(() => expect(updatePathAction).toHaveBeenCalledWith({ ext: "png" }));
  });
});
