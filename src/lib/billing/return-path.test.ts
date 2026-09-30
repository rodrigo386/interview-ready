import { describe, expect, it } from "vitest";
import { prepReturnPath } from "./return-path";

describe("prepReturnPath", () => {
  it("aceita UUID", () => {
    const id = "2c0d734e-16b3-44a2-87cf-9de7fc0212ea";
    expect(prepReturnPath(id)).toBe(`/prep/${id}`);
  });
  it.each([undefined, "", "//evil.com", "https://evil.com", "../admin", ["x"], "2c0d734e"])(
    "recusa %s",
    (v) => {
      expect(prepReturnPath(v)).toBeNull();
    },
  );
});
