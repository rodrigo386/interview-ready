// MUST import before pdf-parse: stubs DOMMatrix/ImageData/Path2D so pdfjs-dist
// doesn't throw "ReferenceError: DOMMatrix is not defined" on PDFs with
// vector transforms when @napi-rs/canvas isn't available at runtime.
import "./dom-polyfill";
import mammoth from "mammoth";
// pdf-parse v2.x exposes a PDFParse class built on pdfjs-dist.
// Marked as a server-external package in next.config.ts so the bundled
// pdf.worker.mjs resolves correctly at runtime.
import { PDFParse } from "pdf-parse";

export type ParsedCV = { text: string; pageCount?: number };

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

const MIN_CHARS = 200;
// Reasonable cap for a CV — 50 pages already covers academic CVs with full
// publication lists. A 5MB PDF can hold thousands of pages of compressed
// text; without this cap, a malicious upload causes pdf-parse to OOM.
const MAX_PDF_PAGES = 50;
// Hard cap on extracted text. Schema uses min(200) — tail is unlikely to
// help a CV interpretation and bloats Gemini token usage.
const MAX_CHARS = 80_000;

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
      if (pageCount && pageCount > MAX_PDF_PAGES) {
        throw new ParseError(
          `Este PDF tem ${pageCount} páginas. O limite é ${MAX_PDF_PAGES} — envie só as páginas relevantes do CV.`,
        );
      }
    } catch (err) {
      if (err instanceof ParseError) throw err;
      throw new ParseError(
        `Couldn't read this PDF: ${err instanceof Error ? err.message : String(err)}. It may be a scanned image or corrupt. Try pasting the text instead.`,
      );
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
      `Tipo de arquivo não suportado: ${mimeType}. Envie um PDF, DOCX ou TXT.`,
    );
  }

  const normalized = normalize(raw);

  if (normalized.length < MIN_CHARS) {
    throw new ParseError(
      "Não conseguimos extrair texto suficiente deste arquivo. Pode ser uma imagem escaneada. Tente colar o texto em vez de enviar o arquivo.",
    );
  }

  // Truncate at MAX_CHARS — cap lifetime exposure on Gemini token usage and
  // the size of the parsed_text column in cvs.
  const text =
    normalized.length > MAX_CHARS ? normalized.slice(0, MAX_CHARS) : normalized;

  return { text, pageCount };
}

function normalize(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
