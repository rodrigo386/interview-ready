// Captura a interface REAL do produto (servidor local em :3100) em WORK/shots.
// Uso: node tools/hero-video/capture.mjs <WORK>
import { chromium } from "@playwright/test";
import fs from "node:fs";

const WORK = process.argv[2];
if (!WORK) throw new Error("uso: capture.mjs <WORK>");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = WORK + "/shots";
fs.mkdirSync(OUT + "/form", { recursive: true });
fs.mkdirSync(OUT + "/wall", { recursive: true });
// o indicador do modo dev do Next aparece em qualquer captura
const HIDE = "nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button]{display:none !important}";
const b = await chromium.launch();

// ---------- A) formulário real do hero (nada é enviado) ----------
let rects;
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(800);
  const card = p.locator("#analisar form").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  const box = await card.boundingBox();
  const rel = async (sel) => {
    const r = await p.locator(sel).first().boundingBox();
    return { x: r.x - box.x, y: r.y - box.y, w: r.width, h: r.height };
  };
  rects = {
    card: { w: box.width, h: box.height },
    jd: await rel("#jobDescription-hero"),
    file: await rel("label:has-text('Escolher arquivo')"),
    submit: await rel("#analisar button[type=submit]"),
  };
  const TEXT = "Gerente de Loja — gestão de perdas e DRE da loja"; // sem ponto final
  const step = 3;
  let n = 0;
  await card.screenshot({ path: OUT + "/form/t00.png" });
  for (let k = step; k < TEXT.length + step; k += step) {
    await p.fill("#jobDescription-hero", TEXT.slice(0, Math.min(k, TEXT.length)));
    n++;
    await card.screenshot({ path: OUT + "/form/t" + String(n).padStart(2, "0") + ".png" });
  }
  rects.typedFrames = n;
  await p.setInputFiles("#cvFile-hero", { name: "curriculo.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 exemplo") });
  await p.waitForTimeout(400);
  await card.screenshot({ path: OUT + "/form/file.png" });
  rects.submitAfterFile = await rel("#analisar button[type=submit]");
  await p.locator("#analisar button[type=submit]").hover();
  await p.waitForTimeout(300);
  await card.screenshot({ path: OUT + "/form/hover.png" });
  await p.mouse.down();
  await p.waitForTimeout(150);
  await card.screenshot({ path: OUT + "/form/press.png" });
  await p.mouse.move(5, 5); // solta FORA do botão: o clique é cancelado e nada é enviado
  await p.mouse.up();
  await ctx.close();
}

// ---------- B) mural e carrossel: 16 páginas ----------
const pages = [
  ["home", "/"], ["exemplo", "/exemplo"], ["ex-gerente", "/exemplo/gerente-de-loja"],
  ["ex-contador", "/exemplo/contador"], ["ex-designer", "/exemplo/designer"], ["ex-compras", "/exemplo/compras"],
  ["ats-gratis", "/analise-ats-gratis"], ["pricing", "/pricing"], ["sobre", "/sobre"], ["artigos", "/artigos"],
  ["a-guia", "/artigos/curriculo-para-ats-guia-completo"], ["a-gerente", "/artigos/curriculo-de-gerente-ats"],
  ["a-contador", "/artigos/curriculo-de-contador-ats"], ["a-reescrever", "/artigos/como-reescrever-curriculo-para-ats"],
  ["a-o-que-e", "/artigos/o-que-e-ats"], ["a-palavras", "/artigos/palavras-chave-curriculo-ats"],
];
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  for (const [name, url] of pages) {
    await p.goto(BASE + url, { waitUntil: "networkidle" });
    await p.addStyleTag({ content: HIDE });
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + "/wall/" + name + ".jpg", type: "jpeg", quality: 88 });
  }
  await ctx.close();
}

// ---------- C) celular (página inteira) ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(BASE + "/exemplo/gerente-de-loja", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + "/mobile-gerente.jpg", type: "jpeg", quality: 90, fullPage: true });
  await ctx.close();
}

// ---------- D) painéis que viram ----------
let panels;
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/exemplo/gerente-de-loja", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(500);
  const ats = p.locator("section:has-text('Etapa 2 · Análise ATS')").first();
  const qs = p.locator("section:has-text('Etapas 3–5 · Perguntas com roteiro')").first();
  await ats.screenshot({ path: OUT + "/panel-ats.png" });
  await qs.screenshot({ path: OUT + "/panel-perguntas.png" });
  const a = await ats.boundingBox(), q = await qs.boundingBox();
  panels = { ats: { w: a.width, h: a.height }, perguntas: { w: q.width, h: q.height } };
  await ctx.close();
}
await b.close();

// o video.html lê as medidas daqui (file:// não deixa fazer fetch de JSON)
fs.writeFileSync(OUT + "/data.js", "window.RECTS=" + JSON.stringify(rects) + ";window.PANELS=" + JSON.stringify(panels) + ";\n");
console.log("capture ok:", OUT);
