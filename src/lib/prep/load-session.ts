import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type PrepSessionRow = {
  id: string;
  generation_status: "pending" | "generating" | "complete" | "failed" | null;
  prep_guide: unknown;
  error_message: string | null;
  ats_status: string | null;
  ats_analysis: unknown;
  ats_error_message: string | null;
  cv_rewrite: unknown;
  cv_rewrite_status: string | null;
  cv_rewrite_error: string | null;
  job_description: string | null;
  company_intel: unknown;
  company_intel_status: string | null;
};

/**
 * Load the full prep_sessions row for the current request, memoized via
 * React `cache()` so layout + child pages share one Supabase roundtrip
 * even though they each call this independently.
 *
 * Returns null if the row doesn't exist or is not visible to the caller
 * (RLS); callers handle notFound/redirect.
 *
 * IMPORTANT: This intentionally selects all columns that any of the prep
 * subroutes need (layout, Tela 1, /ats, /likely, /deep-dive, /ask). When
 * a route needs a new column, add it here rather than running a parallel
 * SELECT.
 */
export const loadPrepSession = cache(async (id: string): Promise<PrepSessionRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prep_sessions")
    .select(
      [
        "id",
        "generation_status",
        "prep_guide",
        "error_message",
        "ats_status",
        "ats_analysis",
        "ats_error_message",
        "cv_rewrite",
        "cv_rewrite_status",
        "cv_rewrite_error",
        "job_description",
        "company_intel",
        "company_intel_status",
      ].join(", "),
    )
    .eq("id", id)
    .single<PrepSessionRow>();

  if (error || !data) return null;
  return data;
});
