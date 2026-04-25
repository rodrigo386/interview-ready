import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PrepGuide, AtsAnalysis, CompanyIntel } from "@/lib/ai/schemas";

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

// pdf-lib's standard fonts (Helvetica) only support WinAnsi (≈Latin-1 +
// CP1252 extras). Emojis, CJK, and most Unicode > 0xFF will throw
// "WinAnsi cannot encode" at draw time. We strip / map common offenders
// before drawing.
const UNICODE_MAP: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  " ": " ",
  " ": " ",
  "​": "",
  "‌": "",
  "‍": "",
  "﻿": "",
};

function sanitize(input: string): string {
  if (!input) return "";
  let out = "";
  for (const ch of input) {
    const mapped = UNICODE_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    // ASCII + Latin-1 Supplement is safe in WinAnsi.
    if (code <= 0xFF) {
      out += ch;
      continue;
    }
    // Anything else (emojis, smart symbols, CJK, etc.) is dropped.
  }
  return out;
}

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
};

function newPage(ctx: Ctx): PDFPage {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.page = page;
  ctx.y = PAGE_H - MARGIN;
  return page;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN) newPage(ctx);
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > max && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(
  ctx: Ctx,
  text: string,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {},
) {
  const size = opts.size ?? 11;
  const font = opts.bold ? ctx.bold : ctx.font;
  const color = opts.color ?? rgb(0.1, 0.1, 0.1);
  const lineHeight = size * 1.4;
  const safe = sanitize(text);
  if (!safe) {
    if (opts.gap) ctx.y -= opts.gap;
    return;
  }
  const lines = wrap(safe, font, size, CONTENT_W);
  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    ctx.page.drawText(line, {
      x: MARGIN,
      y: ctx.y - size,
      size,
      font,
      color,
    });
    ctx.y -= lineHeight;
  }
  if (opts.gap) ctx.y -= opts.gap;
}

function drawDivider(ctx: Ctx) {
  ensureSpace(ctx, 12);
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y - 4 },
    end: { x: PAGE_W - MARGIN, y: ctx.y - 4 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });
  ctx.y -= 12;
}

export async function buildPrepSummaryPdf(input: {
  company: string;
  role: string;
  guide: PrepGuide;
  ats: AtsAnalysis | null;
  intel: CompanyIntel | null;
  jobDescription: string | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(sanitize(`Prep - ${input.company} - ${input.role}`));
  doc.setAuthor("PrepaVAGA");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: 0, font, bold };
  ctx.y = PAGE_H - MARGIN;

  // Cover
  drawText(ctx, "Resumo do prep", { size: 9, bold: true, color: rgb(0.55, 0.35, 0.14) });
  ctx.y -= 4;
  drawText(ctx, input.company, { size: 24, bold: true, gap: 4 });
  drawText(ctx, input.role, { size: 14, color: rgb(0.3, 0.3, 0.3), gap: 16 });
  drawDivider(ctx);

  // ATS
  if (input.ats) {
    drawText(ctx, `Compatibilidade ATS: ${input.ats.score}/100`, { size: 14, bold: true, gap: 4 });
    drawText(ctx, input.ats.overall_assessment, { size: 11, gap: 8 });
    if (input.ats.top_fixes.length > 0) {
      drawText(ctx, "Top ajustes:", { size: 11, bold: true, gap: 4 });
      for (const fix of input.ats.top_fixes.slice(0, 5)) {
        drawText(ctx, `${fix.priority}. ${fix.gap}`, { size: 11, bold: true, gap: 2 });
        drawText(ctx, `Sugestão: ${fix.suggested_rewrite}`, { size: 10, gap: 6 });
      }
    }
    drawDivider(ctx);
  }

  // Company intel
  if (input.intel) {
    drawText(ctx, "Sobre a empresa", { size: 14, bold: true, gap: 6 });
    drawText(ctx, input.intel.overview, { size: 11, gap: 8 });
    if (input.intel.recent_developments.length > 0) {
      drawText(ctx, "Últimas notícias:", { size: 11, bold: true, gap: 4 });
      for (const d of input.intel.recent_developments.slice(0, 5)) {
        drawText(ctx, `• ${d.headline}`, { size: 11, bold: true, gap: 2 });
        drawText(ctx, `  ${d.why_it_matters}`, { size: 10, gap: 6 });
      }
    }
    if (input.intel.strategic_context) {
      drawText(ctx, "Contexto estratégico:", { size: 11, bold: true, gap: 4 });
      drawText(ctx, input.intel.strategic_context, { size: 11, gap: 8 });
    }
    drawDivider(ctx);
  }

  // Sections (likely / deep-dive / ask / etc.)
  for (const section of input.guide.sections) {
    ensureSpace(ctx, 80);
    // Skip the icon (emoji) — sanitize would drop it but keeps a leading
    // space; cleaner to omit altogether.
    drawText(ctx, section.title, {
      size: 16,
      bold: true,
      color: rgb(0.55, 0.35, 0.14),
      gap: 4,
    });
    drawText(ctx, section.summary, { size: 10, color: rgb(0.4, 0.4, 0.4), gap: 10 });
    for (const card of section.cards) {
      ensureSpace(ctx, 50);
      drawText(ctx, `Q: ${card.question}`, { size: 12, bold: true, gap: 4 });
      if (card.key_points.length > 0) {
        drawText(ctx, "Pontos-chave:", { size: 10, bold: true, gap: 2 });
        for (const p of card.key_points) {
          drawText(ctx, `  • ${p}`, { size: 10, gap: 2 });
        }
        ctx.y -= 4;
      }
      drawText(ctx, "Resposta modelo:", { size: 10, bold: true, gap: 2 });
      drawText(ctx, card.sample_answer, { size: 10, gap: 4 });
      if (card.tips) {
        drawText(ctx, `Dica: ${card.tips}`, {
          size: 10,
          color: rgb(0.4, 0.4, 0.4),
          gap: 10,
        });
      }
    }
    drawDivider(ctx);
  }

  return doc.save();
}
