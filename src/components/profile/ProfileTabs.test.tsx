import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ProfileTabs } from "./ProfileTabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile/cvs",
}));

describe("<ProfileTabs />", () => {
  it("renderiza 3 tabs com aria-current na ativa", () => {
    const { getAllByRole } = render(<ProfileTabs />);
    const tabs = getAllByRole("link");
    expect(tabs).toHaveLength(3);
    const active = tabs.find((t) => t.getAttribute("aria-current") === "page");
    expect(active?.textContent).toBe("CVs");
  });

  it("links apontam pras rotas corretas", () => {
    const { getAllByRole } = render(<ProfileTabs />);
    const hrefs = getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/profile", "/profile/cvs", "/profile/account"]);
  });
});
