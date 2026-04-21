import mammoth from "mammoth";
// pdf-parse v2.x exposes a PDFParse class (no debug harness issue like v1.x).
import { PDFParse } from "pdf-parse";

export type ParsedCV = { text: string; pageCount?: number };

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

const MIN_CHARS = 200;

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TXT_MIME = "text/plain";

export const ACCEPTED_MIME_TYPES = [PDF_MIME, DOCX_MIME, TXT_MIME] as const;

export async function parseCvFile(
  buffer: Buffer,
  mimeType: string,
): Promise<ParsedCV> {
  let raw: string;
  let pageCount: number | undefined;

  if (mimeType === PDF_MIME) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      raw = result.text;
      pageCount = result.total;
    } finally {
      await parser.destroy();
    }
  } else if (mimeType === DOCX_MIME) {
    const result = await mammoth.extractRawText({ buffer });
    raw = result.value;
  } else if (mimeType === TXT_MIME) {
    raw = buffer.toString("utf8");
  } else {
    throw new ParseError(
      `Unsupported file type: ${mimeType}. Upload a PDF, DOCX, or TXT.`,
    );
  }

  const text = normalize(raw);

  if (text.length < MIN_CHARS) {
    throw new ParseError(
      "We couldn't extract enough text from this file. It may be a scanned image. Try pasting the text instead.",
    );
  }

  return { text, pageCount };
}

function normalize(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
