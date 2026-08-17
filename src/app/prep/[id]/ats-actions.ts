"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAtsForSession } from "@/lib/prep/run-ats";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";

export async function runAtsAnalysis(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select("id, user_id, ats_status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");

  // Guard against concurrent clicks only; allow re-run after complete/failed.
  if (session.ats_status === "generating") {
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  const rl = await rateLimit(`user:${user.id}`, LIMITS.ats);
  if (!rl.success) {
    await supabase
      .from("prep_sessions")
      .update({
        ats_status: "failed",
        ats_error_message: `Muitas análises ATS em pouco tempo. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
      })
      .eq("id", sessionId);
    revalidatePath(`/prep/${sessionId}`);
    return;
  }

  // Auth + posse + rate limit ficam aqui; o miolo (marcar generating, chamar
  // a IA, gravar complete/failed) é compartilhado com `createPrep`, que
  // dispara a mesma função em background sem nenhum desses três.
  await runAtsForSession(sessionId);

  revalidatePath(`/prep/${sessionId}`);
}
