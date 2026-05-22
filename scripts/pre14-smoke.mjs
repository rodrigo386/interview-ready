// PRE-14 smoke: load the live landing with QA UTM params and confirm the
// PostHog SDK initializes against eu.i.posthog.com (not the app origin) and
// that a landing_view event POST actually leaves the browser.
import { chromium } from "@playwright/test";
import { gunzipSync, inflateSync } from "node:zlib";

const URL =
  "https://prepavaga.com.br/?utm_source=qa-pre14&utm_medium=qa&utm_campaign=qa-pre14-smoke&utm_content=qa&utm_term=qa";

// posthog-js drops events from detected bots — its _is_bot() checks
// navigator.webdriver, the UA string, AND navigator.userAgentData.brands
// (which leaks "HeadlessChrome" in automation). A real visitor trips none
// of these, so to smoke the real event path we present as a normal Chrome.
const browser = await chromium.launch();
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  Object.defineProperty(navigator, "userAgentData", {
    get: () => ({
      brands: [
        { brand: "Google Chrome", version: "131" },
        { brand: "Chromium", version: "131" },
        { brand: "Not_A Brand", version: "24" },
      ],
      mobile: false,
      platform: "Windows",
    }),
  });
});
const page = await context.newPage();

const posthogRequests = [];
const consoleErrors = [];

function isPosthog(u) {
  return u.includes("posthog.com") || /\/(e|flags|array|i\/v0)\b/.test(u);
}

const eventBodies = [];
page.on("request", (req) => {
  const u = req.url();
  if (isPosthog(u)) {
    posthogRequests.push({ method: req.method(), url: u });
    if (req.method() === "POST" && /\/(e|i\/v0\/e|batch)\b/.test(u)) {
      eventBodies.push({ url: u, buf: req.postDataBuffer() });
    }
  }
});
page.on("response", (res) => {
  const u = res.url();
  if (isPosthog(u)) {
    const hit = posthogRequests.find((r) => r.url === u && !r.status);
    if (hit) hit.status = res.status();
  }
});
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(14000);

const utm = await page.evaluate(() =>
  sessionStorage.getItem("prepavaga:utm"),
);
const phState = await page.evaluate(() => {
  const ph = window.posthog;
  if (!ph) return { present: false };
  return {
    present: true,
    loaded: Boolean(ph.__loaded),
    config_api_host: ph.config && ph.config.api_host,
    has_capture: typeof ph.capture === "function",
  };
});

console.log("=== PRE-14 SMOKE ===");
console.log("UTM in sessionStorage:", utm);
console.log("window.posthog:", JSON.stringify(phState));
console.log("\nPostHog-related requests (" + posthogRequests.length + "):");
posthogRequests.forEach((r) =>
  console.log(`  [${r.status ?? "?"}] ${r.method} ${r.url}`),
);
console.log("\nConsole errors (" + consoleErrors.length + "):");
consoleErrors.forEach((e) => console.log("  " + e));

const reqStr = posthogRequests.map((r) => `${r.method} ${r.url}`);
const hitPosthogHost = reqStr.some((r) => r.includes("posthog.com"));
const hitAppOrigin = reqStr.some(
  (r) =>
    r.includes("prepavaga.com.br/array") ||
    r.includes("prepavaga.com.br/flags") ||
    r.includes("prepavaga.com.br/e/"),
);
const mimeError = consoleErrors.some(
  (e) => e.includes("MIME type") && e.includes("not executable"),
);
const cspError = consoleErrors.some((e) =>
  e.includes("Content Security Policy"),
);
const eventPost = reqStr.some(
  (r) => r.startsWith("POST") && /\/(e|i\/v0\/e|batch)\b/.test(r),
);

// Decode each event payload: posthog-js may send gzip-js (raw gzip body),
// deflate, base64, or plain. Try them all and surface the JSON text.
function decodeEvent(buf) {
  if (!buf) return "";
  const candidates = [];
  candidates.push(buf.toString("utf8"));
  try {
    candidates.push(gunzipSync(buf).toString("utf8"));
  } catch {}
  try {
    candidates.push(inflateSync(buf).toString("utf8"));
  } catch {}
  // base64 form: posthog sometimes sends `data=<b64>` or a bare b64 blob.
  const raw = buf.toString("utf8");
  const b64 = raw.startsWith("data=")
    ? decodeURIComponent(raw.slice(5))
    : raw;
  try {
    const bin = Buffer.from(b64, "base64");
    candidates.push(bin.toString("utf8"));
    try {
      candidates.push(gunzipSync(bin).toString("utf8"));
    } catch {}
  } catch {}
  return candidates.find((c) => c && c.includes("landing_view")) || raw;
}

let landingViewWithUtm = false;
console.log("\nEvent payloads captured:", eventBodies.length);
for (const e of eventBodies) {
  const text = decodeEvent(e.buf);
  const hasLanding = text.includes("landing_view");
  const utmKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ].filter((k) => text.includes(k));
  console.log(
    `  ${e.url.split("?")[0]} -> landing_view:${hasLanding} utm:${utmKeys.join(",")}`,
  );
  if (hasLanding && utmKeys.length === 5) landingViewWithUtm = true;
}
console.log("landing_view + all 5 utm_* in payload:", landingViewWithUtm);

console.log("\n=== VERDICT ===");
console.log("SDK hits PostHog host:", hitPosthogHost);
console.log("SDK wrongly hits app origin:", hitAppOrigin);
console.log("MIME error (text/html script):", mimeError);
console.log("CSP-blocked script:", cspError);
console.log("Event POST left browser:", eventPost);
console.log("landing_view carries all 5 utm_*:", landingViewWithUtm);
const pass =
  hitPosthogHost &&
  !hitAppOrigin &&
  !mimeError &&
  !cspError &&
  eventPost &&
  landingViewWithUtm;
console.log("RESULT:", pass ? "PASS" : "FAIL");

await browser.close();
process.exit(pass ? 0 : 1);
