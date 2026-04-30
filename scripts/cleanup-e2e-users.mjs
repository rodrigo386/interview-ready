// Safety-net cleanup of E2E test users that escaped per-test fixture cleanup.
// Deletes auth.users where email matches /^e2e-.*@example\.com$/i. The regex
// is the ONLY thing protecting real users — it must stay in sync with the
// allowlist in /api/test/{confirm,delete}-user.
//
// The Playwright fixture in tests/e2e/auth-required/_helpers.ts cleans up
// users created during a normal test run via /api/test/delete-user. This
// script is a backstop for cases where the fixture didn't run (process
// killed mid-test, network failure during cleanup phase, ad-hoc test runs
// outside Playwright, etc).
//
// Runs at the end of the CI workflow (always(), even on failure) when real
// Supabase credentials are present. Never fails the workflow — opportunistic.
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

const E2E_RX = /^e2e-.*@example\.com$/i;
const PER_PAGE = 1000;

let deleted = 0;
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
  `[cleanup] scanned ${scanned} users · deleted ${deleted} e2e leftovers · failures ${failures}`,
);
process.exit(0);
