import type { PrepSection } from "@/lib/ai/schemas";

export type ClassifiedSections = {
  likely?: PrepSection;
  deepDive?: PrepSection;
  ask?: PrepSection;
};

const matchers = {
  likely: /likely|provav|basic|b[áa]sic/i,
  deepDive: /deep[\s-]?dive|aprofund/i,
  ask: /ask|pergunt.*entrev|to[\s-]?ask|voc[êe].*pergunt/i,
} as const;

function matches(section: PrepSection, kind: keyof typeof matchers): boolean {
  return matchers[kind].test(section.id) || matchers[kind].test(section.title);
}

export function classifyPrepSections(sections: PrepSection[]): ClassifiedSections {
  const result: ClassifiedSections = {};
  const used = new Set<string>();

  for (const kind of ["likely", "deepDive", "ask"] as const) {
    const found = sections.find((s) => !used.has(s.id) && matches(s, kind));
    if (found) {
      result[kind] = found;
      used.add(found.id);
    }
  }

  const remaining = sections.filter((s) => !used.has(s.id));
  if (!result.likely && remaining[0]) result.likely = remaining.shift();
  if (!result.deepDive && remaining[0]) result.deepDive = remaining.shift();
  if (!result.ask && remaining[0]) result.ask = remaining.shift();

  return result;
}
