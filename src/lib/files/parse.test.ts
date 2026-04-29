import { describe, it, expect, beforeAll } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { parseCvFile, ParseError } from "./parse";

const LONG_TEXT =
  "Rodrigo Costa — 10 years in procurement leadership. " +
  "Led $500M addressable spend rollout of e-sourcing platform across 12 LATAM countries. " +
  "Delivered 18% cost takeout and 40% cycle-time reduction over 24 months. " +
  "Digital procurement transformation at Bayer 2019-2022. MBA Insead 2018. " +
  "Private Equity portfolio CFO advisor 2022-present. Senior Director candidate.";

async function makePdf(text: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([600, 800]);
  page.drawText(text, { x: 40, y: 760, size: 10, font, maxWidth: 520, lineHeight: 14 });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

async function makeEmptyPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]);
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

async function makeDocx(text: string): Promise<Buffer> {
  const doc = new Document({
    sections: [{ children: [new Paragraph({ children: [new TextRun(text)] })] }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

describe("parseCvFile", () => {
  let pdfBuf: Buffer;
  let docxBuf: Buffer;
  let emptyPdfBuf: Buffer;

  beforeAll(async () => {
    pdfBuf = await makePdf(LONG_TEXT);
    docxBuf = await makeDocx(LONG_TEXT);
    emptyPdfBuf = await makeEmptyPdf();
  });

  it("extracts text from a PDF", async () => {
    const { text } = await parseCvFile(pdfBuf, "application/pdf");
    expect(text.length).toBeGreaterThanOrEqual(200);
    expect(text).toMatch(/Rodrigo Costa/);
  });

  it("extracts text from a DOCX", async () => {
    const { text } = await parseCvFile(
      docxBuf,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(text.length).toBeGreaterThanOrEqual(200);
    expect(text).toMatch(/Rodrigo Costa/);
  });

  it("extracts text from plain TXT", async () => {
    const { text } = await parseCvFile(Buffer.from(LONG_TEXT, "utf8"), "text/plain");
    expect(text).toContain("Rodrigo Costa");
  });

  it("rejects an image-only PDF with ParseError", async () => {
    await expect(
      parseCvFile(emptyPdfBuf, "application/pdf"),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("rejects unknown mime type", async () => {
    await expect(
      parseCvFile(Buffer.from("x"), "application/zip"),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("collapses 3+ blank lines to 2", async () => {
    const dirty = "a" + "\n".repeat(6) + "b".repeat(300);
    const { text } = await parseCvFile(Buffer.from(dirty, "utf8"), "text/plain");
    expect(text).not.toMatch(/\n{3,}/);
  });

  it("truncates over-long input at MAX_CHARS (80k) — DoS guard for token usage", async () => {
    // 90k chars → expect 80k after truncation.
    const huge = "x".repeat(90_000);
    const { text } = await parseCvFile(Buffer.from(huge, "utf8"), "text/plain");
    expect(text.length).toBe(80_000);
  });

  it("rejects PDFs over MAX_PDF_PAGES (50) with a friendly message", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    // 51 pages — just past the cap.
    for (let i = 0; i < 51; i++) {
      const page = pdf.addPage([600, 800]);
      page.drawText("page " + i, { x: 40, y: 760, size: 10, font });
    }
    const bigBuf = Buffer.from(await pdf.save());
    await expect(parseCvFile(bigBuf, "application/pdf")).rejects.toMatchObject({
      name: "ParseError",
      message: expect.stringMatching(/51 páginas.*limite é 50/),
    });
  }, 30_000);
});
