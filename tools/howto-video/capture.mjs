// Capturas EXTRAS do vídeo "como funciona" (24s). Rode DEPOIS de
// tools/hero-video/capture.mjs, que já gera o formulário real (shots/form/*) e
// shots/panel-perguntas.png no mesmo WORK.
//
// A tela de resultado da análise anônima só existe com uma análise gravada no
// banco, então ela é filmada numa rota TEMPORÁRIA que renderiza as MESMAS
// componentes com dados fictícios. Copie zz-howto-tmp.page.tsx.txt para
// src/app/zz-howto-tmp/page.tsx, suba `pnpm dev -p 3100`, rode este script e
// APAGUE a rota (não commite).
//
// Uso: node tools/howto-video/capture.mjs <WORK>
import { chromium } from "@playwright/test";
import fs from "node:fs";

const WORK = process.argv[2];
if (!WORK) throw new Error("uso: capture.mjs <WORK>");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = WORK + "/shots";
const HIDE = "nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button]{display:none!important}";
const b = await chromium.launch();
const extra = {};

{ // resultado: componentes reais, dados fictícios
  const ctx = await b.newContext({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/zz-howto-tmp", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(2500); // o Gauge leva ~1s pra assentar no valor final
  for (const [name, sel] of [["res-score", "#howto-score"], ["res-fix", "#howto-fix"], ["res-locked", "#howto-locked"], ["res-pitch", "#howto-pitch"]]) {
    const el = p.locator(sel);
    const bb = await el.boundingBox();
    await el.screenshot({ path: OUT + "/" + name + ".png" });
    extra[name] = { w: bb.width, h: bb.height };
  }
  await ctx.close();
}
{ // exemplo: card da vaga (pesquisa da empresa + faixa salarial)
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/exemplo/gerente-de-loja", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(500);
  const vaga = p.locator("section:has-text('A vaga do exemplo')").first();
  const bb = await vaga.boundingBox();
  await vaga.screenshot({ path: OUT + "/ex-vaga.png" });
  extra["ex-vaga"] = { w: bb.width, h: bb.height };
  await ctx.close();
}
{ // formulário: onde fica "Prefiro colar o texto" (relativo ao card)
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const card = p.locator("#analisar form").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  const box = await card.boundingBox();
  const l = await p.locator("#analisar summary, #analisar :text('Prefiro colar o texto')").first().boundingBox();
  extra.colar = { x: l.x - box.x, y: l.y - box.y, w: l.width, h: l.height };
  await ctx.close();
}
await b.close();

// o video.html lê tudo de shots/data.js: acrescenta EXTRA ao que o capture do hero escreveu
const data = fs.readFileSync(OUT + "/data.js", "utf8").replace(/window\.EXTRA=.*?;\n?/s, "");
fs.writeFileSync(OUT + "/data.js", data.trimEnd() + "\nwindow.EXTRA=" + JSON.stringify(extra) + ";\n");
console.log("capture extra ok:", Object.keys(extra).join(", "));
