"use client";

/**
 * Wraps a server-action call. If the action throws (most commonly because the
 * client has a stale bundle from a previous deploy and references an action
 * hash that no longer exists), returns a structured error with `staleAction:
 * true` so the caller can render a "refresh the page" prompt instead of
 * crashing into the global error boundary.
 *
 * Next.js 15 throws "Failed to find Server Action" when the hash is stale.
 */
export const STALE_ACTION_MESSAGE =
  "Atualizamos a app. Atualize a página (Ctrl+Shift+R) e tente novamente.";

export async function safeCall<T>(
  fn: () => Promise<T>,
): Promise<
  | { ok: true; value: T }
  | { ok: false; staleAction: boolean; message: string }
> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stale =
      /Failed to find Server Action/i.test(msg) ||
      /unknown.+action/i.test(msg);
    return {
      ok: false,
      staleAction: stale,
      message: stale ? STALE_ACTION_MESSAGE : `Erro inesperado: ${msg}`,
    };
  }
}
