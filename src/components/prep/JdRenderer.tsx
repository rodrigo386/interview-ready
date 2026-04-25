type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

const BULLET_RE = /^[\s]*[-*•◦▪►]\s+(.*)$/;
const NUMBERED_RE = /^[\s]*\d+[.)]\s+(.*)$/;
const HEADING_TRAILING_COLON_RE = /:\s*$/;

function isBulletLine(line: string): RegExpMatchArray | null {
  return line.match(BULLET_RE) || line.match(NUMBERED_RE);
}

function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return false;
  // Markdown style ###/## headings
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  // Lines ending in ":" with no trailing prose are headings
  if (HEADING_TRAILING_COLON_RE.test(trimmed) && trimmed.split(/\s+/).length <= 8) return true;
  // ALL CAPS short line
  const lettersOnly = trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (
    lettersOnly.length >= 3 &&
    lettersOnly === lettersOnly.toUpperCase() &&
    trimmed.split(/\s+/).length <= 8
  ) {
    return true;
  }
  return false;
}

function cleanHeading(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(HEADING_TRAILING_COLON_RE, "")
    .trim();
}

export function parseJd(text: string): Block[] {
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length > 0) {
      blocks.push({ kind: "list", items: listBuffer });
      listBuffer = [];
    }
  }
  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      const joined = paragraphBuffer.join(" ").trim();
      if (joined) blocks.push({ kind: "paragraph", text: joined });
      paragraphBuffer = [];
    }
  }

  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }

    const bulletMatch = isBulletLine(line);
    if (bulletMatch) {
      flushParagraph();
      listBuffer.push(bulletMatch[1].trim());
      continue;
    }

    if (isLikelyHeading(line)) {
      flushList();
      flushParagraph();
      blocks.push({ kind: "heading", text: cleanHeading(line) });
      continue;
    }

    // Regular prose line — accumulate into a paragraph.
    flushList();
    paragraphBuffer.push(trimmed);
  }
  flushList();
  flushParagraph();

  return blocks;
}

/**
 * Pick a short summary from parsed blocks: the first paragraph, trimmed to
 * the first 2 sentences (or ~280 chars if no terminator).
 */
export function summaryFromBlocks(blocks: Block[]): string | null {
  const firstParagraph = blocks.find((b) => b.kind === "paragraph");
  if (!firstParagraph || firstParagraph.kind !== "paragraph") return null;
  const text = firstParagraph.text;
  // Take up to first 2 sentence terminators (. ! ?), keeping ellipsis at end.
  const sentenceMatch = text.match(/^([^.!?]*[.!?]){1,2}/);
  if (sentenceMatch) {
    const out = sentenceMatch[0].trim();
    return out.length > 320 ? out.slice(0, 320).trim() + "…" : out;
  }
  return text.length > 280 ? text.slice(0, 280).trim() + "…" : text;
}

export function JdBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3 text-[14px] leading-6 text-ink-2">
      {blocks.map((b, i) => {
        if (b.kind === "heading") {
          return (
            <h4
              key={i}
              className="text-[12px] font-bold uppercase tracking-wide text-ink"
            >
              {b.text}
            </h4>
          );
        }
        if (b.kind === "list") {
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span aria-hidden className="mt-0.5 shrink-0 text-orange-500">
                    ▸
                  </span>
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="leading-6">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}
