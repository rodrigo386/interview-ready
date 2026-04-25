import { describe, expect, it } from "vitest";
import { resolveAvatarUrl } from "./avatar-url";

function fakeStorage(publicUrl: string) {
  return {
    storage: {
      from: (_bucket: string) => ({
        getPublicUrl: (_path: string) => ({ data: { publicUrl } }),
      }),
    },
  } as Parameters<typeof resolveAvatarUrl>[1];
}

describe("resolveAvatarUrl", () => {
  it("retorna Gravatar quando avatarPath é null", () => {
    const url = resolveAvatarUrl(
      { email: "foo@bar.com", avatarPath: null, avatarUpdatedAt: null },
      fakeStorage(""),
    );
    expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\//);
    expect(url).toMatch(/\?d=mp&s=128$/);
  });

  it("retorna URL pública com cache-bust quando avatarPath presente", () => {
    const url = resolveAvatarUrl(
      {
        email: "foo@bar.com",
        avatarPath: "uid-abc/avatar.jpg",
        avatarUpdatedAt: "2026-04-24T12:00:00Z",
      },
      fakeStorage("https://cdn.example/uid-abc/avatar.jpg"),
    );
    const expectedV = new Date("2026-04-24T12:00:00Z").getTime();
    expect(url).toBe(`https://cdn.example/uid-abc/avatar.jpg?v=${expectedV}`);
  });

  it("usa v=0 quando avatarUpdatedAt é null mas path existe", () => {
    const url = resolveAvatarUrl(
      { email: "foo@bar.com", avatarPath: "uid/avatar.png", avatarUpdatedAt: null },
      fakeStorage("https://cdn.example/uid/avatar.png"),
    );
    expect(url).toBe("https://cdn.example/uid/avatar.png?v=0");
  });
});
