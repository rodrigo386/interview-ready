/**
 * Normalises a pathname for page-view tracking, or returns null when it
 * should not be recorded at all.
 *
 * Until 2026-08, every in-app path (/dashboard, /prep, /profile, /partner)
 * was dropped client-side. That made the whole post-signup funnel invisible:
 * of 15 users who reached a session, 7 never uploaded a CV and there was no
 * way to tell whether they opened /prep/new and gave up or never got there.
 * Those paths are tracked now; only operator traffic (/admin) is dropped.
 *
 * Prep ids collapse to /prep/[id] — they are per-user resources, so keeping
 * them would put identifiers in the table and scatter the top-paths report
 * across one row per prep.
 *
 * No "server-only" import: this runs in the client tracker too.
 */

const MAX_LENGTH = 300;

/**
 * Logged-in area. Tracked (that is the point of this change) but kept out of
 * the "Visitas ao site" KPIs, which are about site traffic — folding app
 * navigation into them would change what the number means.
 */
export const APP_PATH_PREFIXES = [
  "/dashboard",
  "/prep",
  "/profile",
  "/partner",
] as const;

export function isAppPath(path: string): boolean {
  return APP_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** UUID or nanoid-ish segment — anything that looks like a generated id. */
const ID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeTrackedPath(pathname: string): string | null {
  if (typeof pathname !== "string") return null;

  // Drop query and hash so /pricing and /pricing?utm_source=x aggregate.
  const clean = pathname.split(/[?#]/)[0];
  if (!clean.startsWith("/")) return null;

  // Operator traffic would swamp the numbers and is not what /admin reports on.
  if (clean === "/admin" || clean.startsWith("/admin/")) return null;

  const segments = clean.split("/").filter(Boolean);

  // /prep/<id> and /prep/<id>/<step> → /prep/[id][/<step>]
  if (segments[0] === "prep" && segments[1] && segments[1] !== "new") {
    if (ID_SEGMENT.test(segments[1])) {
      const rest = segments.slice(2).join("/");
      return rest ? `/prep/[id]/${rest}` : "/prep/[id]";
    }
  }

  const normalized = segments.length === 0 ? "/" : `/${segments.join("/")}`;
  return normalized.slice(0, MAX_LENGTH);
}
