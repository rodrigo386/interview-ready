import { describe, expect, it } from "vitest";
import { gravatarUrl } from "./gravatar";

describe("gravatarUrl", () => {
  it("computa MD5 do email lowercase + trim", () => {
    // md5("rgoalves@gmail.com") = f4c4a4391bf6714a053ae35ef1c475ce
    expect(gravatarUrl("  RGoalves@Gmail.com  ", 128)).toBe(
      "https://www.gravatar.com/avatar/f4c4a4391bf6714a053ae35ef1c475ce?d=mp&s=128",
    );
  });

  it("usa default size=128 quando não informado", () => {
    expect(gravatarUrl("foo@bar.com")).toMatch(/\?d=mp&s=128$/);
  });

  it("aceita size custom", () => {
    expect(gravatarUrl("foo@bar.com", 256)).toMatch(/\?d=mp&s=256$/);
  });

  it("sempre lowercase no hash mesmo se input já vier minúsculo", () => {
    expect(gravatarUrl("foo@bar.com", 64)).toBe(gravatarUrl("FOO@BAR.COM", 64));
  });
});
