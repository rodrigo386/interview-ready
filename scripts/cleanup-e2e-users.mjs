// Best-effort cleanup of E2E test users created by Playwright in CI.
// Deletes auth.users where email matches /^e2e-.*@example\.com$/i AND
// created_at > 1 day ago. Profiles/prep_sessions/cvs cascade via FK.
//
// Runs at the end of the CI workflow (always(), even on failure) when
// real Supabase staging credentials are present. Failures here never
// fail the workflow — cleanup is opportunistic.
//
// Usage: node scripts/cleanup-e2e-users.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || url.includes("placeholder.supabase.co")) {
  console.log("[cleanup] no real Supabase configured, skipping");
  process.exit(0);
}

const sb = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ONE_DAY_AGO = Date.now() - 24 * 60 * 60 * 1000;
const E2E_RX = /^e2e-.*@example\.com$/i;
const PER_PAGE = 1000;

let deleted = 0;
let kept = 0;
let scanned = 0;
let failures = 0;
let page = 1;

try {
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) {
      console.error(`[cleanup] listUsers page ${page} failed:`, error.message);
      process.exit(0);
    }
    if (!data.users.length) break;
    scanned += data.users.length;

    for (const u of data.users) {
      if (!u.email || !E2E_RX.test(u.email)) continue;
      const created = new Date(u.created_at).getTime();
      if (created > ONE_DAY_AGO) {
        kept++;
        continue;
      }
      const { error: delErr } = await sb.auth.admin.deleteUser(u.id);
      if (delErr) {
        failures++;
        console.warn(`[cleanup] failed to delete ${u.email}:`, delErr.message);
      } else {
        deleted++;
      }
    }
    if (data.users.length < PER_PAGE) break;
    page++;
  }
} catch (err) {
  console.warn("[cleanup] unexpected error:", err);
  process.exit(0);
}

console.log(
  `[cleanup] scanned ${scanned} users · deleted ${deleted} e2e (>1 day old) · kept ${kept} recent · failures ${failures}`,
);
process.exit(0);
