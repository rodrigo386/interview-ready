import type { Metadata } from "next";
import { companyIntelSchema } from "@/lib/ai/schemas";
import { Tela1Visual } from "@/components/prep/Tela1Visual";
import { loadPrepSession } from "@/lib/prep/load-session";

export const metadata: Metadata = {
  title: "Prep · PrepaVaga",
};

export default async function PrepHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadPrepSession(id);

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
