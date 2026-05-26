/**
 * Best-effort guess at a display name from the email local-part. Used as the
 * default `full_name` when the user signs up (PRE-14 removed the name field
 * from the form). Always overridable in /profile.
 *
 * Lives in lib/ — not in the `"use server"` actions.ts — because Server
 * Actions files can only export async functions. Same reason for the
 * tests being colocated here.
 *
 * Examples:
 *   ana.silva@x.com → "Ana Silva"
 *   joao_pedro_123@x.com → "Joao Pedro 123"
 *   anaSilva@x.com → "Ana Silva"  (split on camelHumps)
 *   x@x.com → "X"
 */
export function deriveNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  if (!local) return "";
  return local
    .replace(/[._+-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
