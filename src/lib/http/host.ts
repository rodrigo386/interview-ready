import "server-only";
import { env } from "@/lib/env";

/**
 * Resolve the actual public origin from a request, preferring the Railway-
 * forwarded host so links/callbacks return users to the same domain they
 * started on (e.g. prepavaga.com.br even when NEXT_PUBLIC_APP_URL still
 * points to a railway.app fallback).
 *
 * Falls back to NEXT_PUBLIC_APP_URL, then to the request URL's own origin.
 *
 * Accepts either a `Request`/`NextRequest` (for route handlers) or an
 * already-parsed `Headers` object (for server actions where you've already
 * called `headers()`).
 */
export function resolveOrigin(input: Request | Headers): string {
  const h = input instanceof Headers ? input : input.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL;
  // Last-resort: parse the URL of the request when given one.
  if (input instanceof Request) {
    try {
      return new URL(input.url).origin;
    } catch {
      // ignore
    }
  }
  return "http://localhost:3000";
}
