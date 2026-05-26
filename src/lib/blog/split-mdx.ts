export type MdxSplit = { before: string; after: string };

/**
 * Splits MDX article content at a midpoint H2 heading so a CTA can be
 * injected between two MDXRemote renders. Avoids cutting mid-paragraph
 * (would break formatting) or right after the intro (would interrupt the
 * setup before the reader is invested).
 *
 * Strategy:
 *   1. Find all top-level `## ` headings (start of line).
 *   2. Skip articles with fewer than 3 headings — too short to interrupt.
 *   3. Pick the heading closest to the middle by index (NOT byte position
 *      — keeps the split balanced by sections, not character count).
 *   4. Return { before, after } where `after` starts at that heading.
 *
 * Returns null when the article is too short — caller should render the
 * unsplit content with no inline CTA.
 */
export function splitMdxAtMidpoint(content: string): MdxSplit | null {
  if (!content) return null;
  const lines = content.split("\n");
  const h2Indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+\S/.test(lines[i])) h2Indices.push(i);
  }
  if (h2Indices.length < 3) return null;

  // Pick the H2 closest to the middle of the heading list. Round up so
  // we never pick the first heading (which would put the CTA above the
  // intro section).
  const midIdx = Math.ceil(h2Indices.length / 2);
  const splitLine = h2Indices[midIdx];
  if (splitLine === undefined) return null;

  const before = lines.slice(0, splitLine).join("\n").trimEnd();
  const after = lines.slice(splitLine).join("\n").trimStart();
  if (!before || !after) return null;
  return { before, after };
}
