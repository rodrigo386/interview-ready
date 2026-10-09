// Renderiza subquadros de WORK/video.html em WORK/frames/sub (3 por quadro: t-1/240, t, t+1/240).
// Uso:
//   sondagem:  node render.mjs <WORK> probe '[0.7,4.3,9.2]'   -> WORK/frames/probe/p_<t>.jpg
//   faixa:     node render.mjs <WORK> range <de> <ate>        -> quadros [de, ate) a 60fps
// Para 1200 quadros (20s), rode 4 faixas em paralelo (0-300, 300-600, ...).
// Para outro vídeo: DUR=24 node render.mjs <WORK> range 0 360 (1440 quadros em 4 faixas de 360).
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [WORK, mode, a, b] = process.argv.slice(2);
if (!WORK || !mode) throw new Error("uso: render.mjs <WORK> probe '[t...]' | range <de> <ate>");
const FPS = 60, DUR = Number(process.env.DUR ?? 20); // segundos: 20 (promo), 24 (como funciona)
const br = await chromium.launch();
const p = await br.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await p.goto("file://" + WORK + "/video.html");
await p.evaluate(() => window.__ready);

if (mode === "probe") {
  fs.mkdirSync(WORK + "/frames/probe", { recursive: true });
  for (const t of JSON.parse(a)) {
    await p.evaluate((x) => window.seek(x), t);
    await p.screenshot({ path: WORK + "/frames/probe/p_" + t.toFixed(2) + ".jpg", type: "jpeg", quality: 85 });
  }
} else {
  fs.mkdirSync(WORK + "/frames/sub", { recursive: true });
  for (let f = Number(a); f < Number(b); f++) {
    const t = f / FPS;
    for (let s = 0; s < 3; s++) {
      const tt = Math.min(DUR, Math.max(0, t + (s - 1) / 240));
      await p.evaluate((x) => window.seek(x), tt);
      await p.screenshot({ path: WORK + "/frames/sub/f" + String(f).padStart(5, "0") + "_" + s + ".jpg", type: "jpeg", quality: 92 });
    }
  }
}
await br.close();
console.log("render ok", mode, a, b ?? "");
