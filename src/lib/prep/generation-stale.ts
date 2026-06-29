/**
 * A prep stuck in "generating"/"pending" longer than this is almost certainly a
 * zombie: the fire-and-forget background generation died (Railway redeploy mid-
 * run, a crash, or an error that escaped the pipeline's terminal-status write)
 * and the row will never reach 'complete'/'failed' on its own.
 *
 * A real generation finishes in ~2-4 min (Stage A + salary + 5 sequential
 * section calls with 1.5s gaps). 15 min is comfortably past that, so anything
 * older is treated as failed — the prep layout then renders the retry UI instead
 * of an eternal skeleton, letting the user recover with one click (retryPrep
 * reuses the saved CV + JD).
 *
 * Found via a paying (Pro) user whose prep sat in "generating" for 53 days.
 */
export const STALE_GENERATION_MS = 15 * 60 * 1000;

export function isGenerationStale(
  status: string | null | undefined,
  createdAtIso: string | null | undefined,
  nowMs: number,
): boolean {
  if (status !== "generating" && status !== "pending") return false;
  if (!createdAtIso) return false;
  const created = new Date(createdAtIso).getTime();
  if (Number.isNaN(created)) return false;
  return nowMs - created > STALE_GENERATION_MS;
}
