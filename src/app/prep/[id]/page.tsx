import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { companyIntelSchema } from "@/lib/ai/schemas";
import { Tela1Visual } from "@/components/prep/Tela1Visual";

export const metadata: Metadata = {
  title: "Prep — PrepaVaga",
};

export default async function PrepHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("prep_sessions")
    .select("job_description, company_intel, company_intel_status")
    .eq("id", id)
    .single<{
      job_description: string | null;
      company_intel: unknown;
      company_intel_status: string | null;
    }>();

  const intelParsed =
    data?.company_intel_status === "complete"
      ? companyIntelSchema.safeParse(data?.company_intel)
      : null;
  const companyIntel = intelParsed?.success ? intelParsed.data : null;

  return (
    <Tela1Visual
      sessionId={id}
      jobDescription={data?.job_description ?? null}
      companyIntel={companyIntel}
      companyIntelStatus={data?.company_intel_status ?? null}
    />
  );
}
