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

import { splitMdxForCta } from "./split-mdx";

describe("splitMdxForCta", () => {
  it("com 3+ H2 se comporta como o split por título", () => {
    const content = "Intro.\n\n## A\na\n\n## B\nb\n\n## C\nc";
    expect(splitMdxForCta(content)).toEqual(splitMdxAtMidpoint(content));
  });

  it("artigo curto (2 H2) ganha um ponto de inserção por blocos", () => {
    const content = [
      "Intro um.",
      "Intro dois.",
      "## A\nCorpo A.",
      "Mais A.",
      "## B\nCorpo B.",
      "Mais B.",
    ].join("\n\n");
    const split = splitMdxForCta(content);
    expect(split).not.toBeNull();
    expect(split!.before).toBeTruthy();
    expect(split!.after).toBeTruthy();
    expect(`${split!.before}\n\n${split!.after}`).toBe(content);
  });

  it("não corta logo depois de um título", () => {
    const content = ["a", "b", "## Título", "texto", "c", "d"].join("\n\n");
    const split = splitMdxForCta(content);
    expect(split).not.toBeNull();
    expect(split!.before.trimEnd().endsWith("## Título")).toBe(false);
  });

  it("não corta dentro de bloco de código", () => {
    const content = ["a", "b", "```\nx\n\ny\n```", "c", "d"].join("\n\n");
    const split = splitMdxForCta(content);
    if (split) {
      const fences = (split.before.match(/^```/gm) ?? []).length;
      expect(fences % 2).toBe(0);
    }
  });

  it("texto minúsculo fica sem CTA no meio", () => {
    expect(splitMdxForCta("Um.\n\nDois.\n\nTrês.")).toBeNull();
    expect(splitMdxForCta("")).toBeNull();
  });
});
