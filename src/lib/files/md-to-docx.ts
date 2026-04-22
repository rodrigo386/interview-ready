import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

/**
 * Convert a small markdown subset into a DOCX Buffer.
 *
 * Supported:
 *   - `## Heading` → HeadingLevel.HEADING_1
 *   - `### Subheading` → HeadingLevel.HEADING_2
 *   - `- item` → bulleted paragraph (level 0)
 *   - `**bold**` inline → TextRun with bold: true
 *   - Blank lines → paragraph breaks
 *   - Everything else → normal paragraph
 *
 * Not supported (YAGNI for CV content): tables, links, code blocks, images.
 */
export async function mdToDocx(markdown: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      paragraphs.push(new Paragraph({ children: [] }));
      continue;
    }
    if (trimmed.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: renderInline(trimmed.slice(4)),
        }),
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: renderInline(trimmed.slice(3)),
        }),
      );
      continue;
    }
    if (trimmed.startsWith("- ")) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: renderInline(trimmed.slice(2)),
        }),
      );
      continue;
    }
    paragraphs.push(
      new Paragraph({ children: renderInline(trimmed) }),
    );
  }

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

function renderInline(line: string): TextRun[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p !== "")
    .map((p) =>
      p.startsWith("**") && p.endsWith("**")
        ? new TextRun({ text: p.slice(2, -2), bold: true })
        : new TextRun(p),
    );
}
