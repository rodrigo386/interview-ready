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
    } catch (err) {
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

  const text = normalize(raw);

  if (text.length < MIN_CHARS) {
    throw new ParseError(
      "Não conseguimos extrair texto suficiente deste arquivo. Pode ser uma imagem escaneada. Tente colar o texto em vez de enviar o arquivo.",
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
