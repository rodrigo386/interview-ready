import { describe, it, expect } from "vitest";
import { splitMdxAtMidpoint } from "./split-mdx";

describe("splitMdxAtMidpoint", () => {
  it("returns null for content with < 3 H2s", () => {
    const content = `Intro.\n\n## Only\n\nBody.\n\n## One more\n\nBody.`;
    expect(splitMdxAtMidpoint(content)).toBe(null);
  });

  it("returns null for empty content", () => {
    expect(splitMdxAtMidpoint("")).toBe(null);
  });

  it("splits at the middle H2 in a 4-H2 article", () => {
    const content = [
      "Intro paragraph.",
      "",
      "## First",
      "Section A body.",
      "",
      "## Second",
      "Section B body.",
      "",
      "## Third",
      "Section C body.",
      "",
      "## Fourth",
      "Section D body.",
    ].join("\n");
    const split = splitMdxAtMidpoint(content);
    expect(split).not.toBeNull();
    expect(split!.before).toContain("## First");
    expect(split!.before).toContain("## Second");
    expect(split!.before).not.toContain("## Third");
    expect(split!.after.startsWith("## Third")).toBe(true);
  });

  it("never picks the very first H2 (keeps intro intact)", () => {
    const content = [
      "Intro.",
      "",
      "## A",
      "a",
      "",
      "## B",
      "b",
      "",
      "## C",
      "c",
    ].join("\n");
    const split = splitMdxAtMidpoint(content);
    expect(split).not.toBeNull();
    // 3 headings → midIdx = ceil(3/2) = 2 → splits at "## C"
    expect(split!.before).toContain("## A");
    expect(split!.before).toContain("## B");
    expect(split!.after.startsWith("## C")).toBe(true);
  });

  it("ignores ### and deeper headings when counting", () => {
    const content = [
      "Intro.",
      "",
      "## Real",
      "### Nested",
      "stuff",
      "",
      "## Real two",
      "more",
      "",
      "### Another nested",
      "",
      "## Real three",
      "end",
    ].join("\n");
    const split = splitMdxAtMidpoint(content);
    expect(split).not.toBeNull();
    // 3 H2s detected (### ignored) → splits at the 2nd (idx 1, since
    // ceil(3/2)=2 → indices[2] = "## Real three")
    expect(split!.after.startsWith("## Real three")).toBe(true);
  });
});
