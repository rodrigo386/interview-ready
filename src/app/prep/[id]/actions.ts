"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  generateCompanyIntel,
  generateSalaryBenchmark,
  GeminiResponseError,
} from "@/lib/ai/gemini";
import { buildCompanyResearchPrompt } from "@/lib/ai/prompts/company-research";
import { buildSalaryBenchmarkPrompt } from "@/lib/ai/prompts/salary-benchmark";
import { rateLimit, LIMITS, formatResetPhrase } from "@/lib/ratelimit";

export async function deletePrep(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("prep_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function rerunCompanyIntel(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select("id, company_name, job_title, company_intel_status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");
  if (session.company_intel_status === "researching") {
    revalidatePath(`/prep/${id}`);
    return;
  }

  const rl = await rateLimit(`user:${user.id}`, LIMITS.companyIntel);
  if (!rl.success) {
    await supabase
      .from("prep_sessions")
      .update({
        company_intel_status: "failed",
        company_intel_error: `Muitas pesquisas de empresa em pouco tempo. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
      })
      .eq("id", id);
    revalidatePath(`/prep/${id}`);
    return;
  }

  await supabase
    .from("prep_sessions")
    .update({
      company_intel_status: "researching",
      company_intel: null,
      company_intel_error: null,
    })
    .eq("id", id);

  try {
    const prompt = buildCompanyResearchPrompt({
      companyName: session.company_name,
      jobTitle: session.job_title,
    });
    const intel = await generateCompanyIntel(prompt);
    if (intel) {
      await supabase
        .from("prep_sessions")
        .update({ company_intel: intel, company_intel_status: "complete" })
        .eq("id", id);
    } else {
      await supabase
        .from("prep_sessions")
        .update({ company_intel_status: "skipped" })
        .eq("id", id);
    }
  } catch (err) {
    console.error(`[rerunCompanyIntel ${id}] failed:`, err);
    const message = formatIntelError(err).slice(0, 8000);
    await supabase
      .from("prep_sessions")
      .update({
        company_intel_status: "failed",
        company_intel_error: message,
      })
      .eq("id", id);
  }

  revalidatePath(`/prep/${id}`);
}

export async function rerunSalaryBenchmark(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, company_name, job_title, job_description, salary_benchmark_status",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) redirect("/dashboard");
  if (session.salary_benchmark_status === "researching") {
    revalidatePath(`/prep/${id}`);
    return;
  }

  const rl = await rateLimit(`user:${user.id}`, LIMITS.salaryBenchmark);
  if (!rl.success) {
    await supabase
      .from("prep_sessions")
      .update({
        salary_benchmark_status: "failed",
        salary_benchmark_error: `Muitas pesquisas salariais em pouco tempo. Tente novamente em ${formatResetPhrase(rl.reset)}.`,
      })
      .eq("id", id);
    revalidatePath(`/prep/${id}`);
    return;
  }

  await supabase
    .from("prep_sessions")
    .update({
      salary_benchmark_status: "researching",
      salary_benchmark: null,
      salary_benchmark_error: null,
    })
    .eq("id", id);

  try {
    const prompt = buildSalaryBenchmarkPrompt({
      companyName: session.company_name,
      jobTitle: session.job_title,
      jobDescription: session.job_description ?? "",
    });
    const benchmark = await generateSalaryBenchmark(prompt);
    if (benchmark) {
      await supabase
        .from("prep_sessions")
        .update({
          salary_benchmark: benchmark,
          salary_benchmark_status: "complete",
        })
        .eq("id", id);
    } else {
      await supabase
        .from("prep_sessions")
        .update({ salary_benchmark_status: "skipped" })
        .eq("id", id);
    }
  } catch (err) {
    console.error(`[rerunSalaryBenchmark ${id}] failed:`, err);
    const message = formatIntelError(err).slice(0, 8000);
    await supabase
      .from("prep_sessions")
      .update({
        salary_benchmark_status: "failed",
        salary_benchmark_error: message,
      })
      .eq("id", id);
  }

  revalidatePath(`/prep/${id}`);
}

function formatIntelError(err: unknown): string {
  if (err instanceof GeminiResponseError) {
    return `${err.message}\n\nRAW RESPONSE:\n${err.rawResponse}`;
  }
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  return String(err);
}
