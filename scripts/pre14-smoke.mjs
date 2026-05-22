// PRE-14 smoke: load the live landing with QA UTM params and confirm the
// PostHog SDK initializes against eu.i.posthog.com (not the app origin) and
// that a landing_view event POST actually leaves the browser.
import { chromium } from "@playwright/test";

const URL =
  "https://prepavaga.com.br/?utm_source=qa-pre14&utm_medium=qa&utm_campaign=qa-pre14-smoke&utm_content=qa&utm_term=qa";

const browser = await chromium.launch();
const page = await browser.newPage();

const posthogRequests = [];
const consoleErrors = [];

page.on("request", (req) => {
  const u = req.url();
  if (u.includes("posthog.com") || /\/(e|flags|array|i\/v0)\b/.test(u)) {
    posthogRequests.push(`${req.method()} ${u}`);
  }
});
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(6000);

const utm = await page.evaluate(() =>
  sessionStorage.getItem("prepavaga:utm"),
);

console.log("=== PRE-14 SMOKE ===");
console.log("UTM in sessionStorage:", utm);
console.log("\nPostHog-related requests (" + posthogRequests.length + "):");
posthogRequests.forEach((r) => console.log("  " + r));
console.log("\nConsole errors (" + consoleErrors.length + "):");
consoleErrors.forEach((e) => console.log("  " + e));

const hitPosthogHost = posthogRequests.some((r) =>
  r.includes("posthog.com"),
);
const hitAppOrigin = posthogRequests.some((r) =>
  r.includes("prepavaga.com.br/array") ||
  r.includes("prepavaga.com.br/flags") ||
  r.includes("prepavaga.com.br/e/"),
);
const mimeError = consoleErrors.some((e) =>
  e.includes("MIME type") && e.includes("not executable"),
);
const cspError = consoleErrors.some((e) =>
  e.includes("Content Security Policy"),
);
const eventPost = posthogRequests.some(
  (r) => r.startsWith("POST") && /\/(e|i\/v0\/e|batch)\b/.test(r),
);

console.log("\n=== VERDICT ===");
console.log("SDK hits PostHog host:", hitPosthogHost);
console.log("SDK wrongly hits app origin:", hitAppOrigin);
console.log("MIME error (text/html script):", mimeError);
console.log("CSP-blocked script:", cspError);
console.log("Event POST left browser:", eventPost);
const pass =
  hitPosthogHost && !hitAppOrigin && !mimeError && !cspError && eventPost;
console.log("RESULT:", pass ? "PASS" : "FAIL");

await browser.close();
process.exit(pass ? 0 : 1);
