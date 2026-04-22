import { runPipeline } from "@/lib/ai/pipeline";

/**
 * Preserved as the public entry for retryPrep and createPrep. Delegates
 * to the new multi-stage pipeline.
 */
export async function runGeneration(sessionId: string): Promise<void> {
  return runPipeline(sessionId);
}
