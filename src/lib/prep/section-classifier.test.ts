import { describe, expect, it } from "vitest";
import { classifyPrepSections } from "./section-classifier";
import type { PrepSection } from "@/lib/ai/schemas";

const make = (id: string, title = id): PrepSection => ({
  id,
  title,
  icon: "🎯",
  summary: "x",
  cards: [
    {
      id: "c1",
      question: "q?",
      key_points: ["p1"],
      sample_answer: "a".repeat(60),
      tips: "t",
      confidence_level: "high",
      references_cv: [],
    },
  ],
});

describe("classifyPrepSections", () => {
  it("mapeia por id explícito (likely/deep/ask)", () => {
    const out = classifyPrepSections([
      make("likely-questions"),
      make("deep-dive"),
      make("questions-to-ask"),
    ]);
    expect(out.likely?.id).toBe("likely-questions");
    expect(out.deepDive?.id).toBe("deep-dive");
    expect(out.ask?.id).toBe("questions-to-ask");
  });

  it("mapeia por título quando id é genérico", () => {
    const out = classifyPrepSections([
      make("s1", "Likely Questions"),
      make("s2", "Deep Dive"),
      make("s3", "Questions to Ask"),
    ]);
    expect(out.likely?.id).toBe("s1");
    expect(out.deepDive?.id).toBe("s2");
    expect(out.ask?.id).toBe("s3");
  });

  it("fallback posicional quando nenhum keyword bate", () => {
    const out = classifyPrepSections([make("a"), make("b"), make("c")]);
    expect(out.likely?.id).toBe("a");
    expect(out.deepDive?.id).toBe("b");
    expect(out.ask?.id).toBe("c");
  });

  it("retorna undefined para slot ausente", () => {
    const out = classifyPrepSections([make("likely")]);
    expect(out.likely?.id).toBe("likely");
    expect(out.deepDive).toBeUndefined();
    expect(out.ask).toBeUndefined();
  });

  it("não confunde 'deep' com 'likely' (keyword wins sobre posição)", () => {
    const out = classifyPrepSections([make("deep-dive"), make("likely-questions")]);
    expect(out.likely?.id).toBe("likely-questions");
    expect(out.deepDive?.id).toBe("deep-dive");
  });
});
