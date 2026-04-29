import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { signUpAndLand } from "./_helpers";

const CV_BODY =
  "Rodrigo Costa — 10 years in procurement leadership. " +
  "Led $500M addressable spend rollout of e-sourcing platform across 12 LATAM countries. " +
  "Delivered 18% cost takeout and 40% cycle-time reduction over 24 months. " +
  "Digital procurement transformation at Bayer 2019-2022. MBA Insead 2018. " +
  "Private Equity portfolio CFO advisor 2022-present.";

const JD_TEXT =
  "Senior Director, AI & Digital Procurement Transformation. " +
  "Hexion is a $3B specialty chemicals company, sponsor-owned. " +
  "You will design and deploy agentic AI sourcing capability across $300M+ addressable spend. " +
  "Responsibilities include: build the target operating model, stand up an AI Center of Excellence, " +
  "deploy AI Sourcing Agents for autonomous negotiation on tail spend, and drive touchless P2P. " +
  "Qualifications: 10+ years procurement transformation, hands-on AI deployment, PE experience preferred.";

async function makePdfBuffer(text: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([600, 800]);
  page.drawText(text, { x: 40, y: 760, size: 10, font, maxWidth: 520, lineHeight: 14 });
  return Buffer.from(await pdf.save());
}

async function makeEmptyPdfBuffer(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]);
  return Buffer.from(await pdf.save());
}

async function signup(page: import("@playwright/test").Page) {
  return signUpAndLand(page, "E2E Upload Tester", "e2e-upload");
}

test("upload PDF, create prep, reuse CV on second prep", async ({ page }) => {
  await signup(page);
  await page.getByRole("link", { name: /primeiro prep|novo prep/i }).first().click();
  await page.waitForURL("**/prep/new");

  const pdfBuffer = await makePdfBuffer(CV_BODY);

  await page.getByLabel("Empresa").fill("Hexion");
  await page.getByLabel("Cargo").fill("Senior Director, AI Procurement");

  await page.setInputFiles('input[type="file"]', {
    name: "rodrigo-cv.pdf",
    mimeType: "application/pdf",
    buffer: pdfBuffer,
  });
  await expect(page.getByText(/Enviado: rodrigo-cv\.pdf/)).toBeVisible({ timeout: 15_000 });

  await page.getByLabel(/Descrição da vaga/i).fill(JD_TEXT);
  await page.getByRole("button", { name: /gerar meu dossiê/i }).click();

  await page.waitForURL("**/prep/**", { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Hexion" })).toBeVisible({ timeout: 10_000 });

  // Segundo prep — reusa o CV já enviado
  await page.goto("/prep/new");
  await expect(page.getByText("rodrigo-cv.pdf")).toBeVisible();
  await page.getByLabel("Empresa").fill("BASF");
  await page.getByLabel("Cargo").fill("Director, Procurement");
  await page.getByLabel(/Descrição da vaga/i).fill(JD_TEXT);
  await page.getByRole("button", { name: /gerar meu dossiê/i }).click();
  await page.waitForURL("**/prep/**", { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "BASF" })).toBeVisible({ timeout: 10_000 });
});

test("paste fallback still works", async ({ page }) => {
  await signup(page);
  await page.goto("/prep/new");

  await page.getByLabel("Empresa").fill("Acme");
  await page.getByLabel("Cargo").fill("Director");
  await page.getByRole("button", { name: /colar texto em vez disso/i }).click();
  await page.getByLabel(/Cole o texto do seu CV/i).fill(CV_BODY);
  await page.getByLabel(/Descrição da vaga/i).fill(JD_TEXT);
  await page.getByRole("button", { name: /gerar meu dossiê/i }).click();

  await page.waitForURL("**/prep/**", { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Acme" })).toBeVisible({ timeout: 10_000 });
});

test("empty PDF is rejected with a helpful message", async ({ page }) => {
  await signup(page);
  await page.goto("/prep/new");

  const emptyPdf = await makeEmptyPdfBuffer();

  await page.setInputFiles('input[type="file"]', {
    name: "scanned.pdf",
    mimeType: "application/pdf",
    buffer: emptyPdf,
  });

  await expect(
    page.getByText(/não conseguimos extrair/i),
  ).toBeVisible({ timeout: 10_000 });
});
