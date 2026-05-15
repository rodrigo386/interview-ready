import type { Metadata } from "next";
import { companyIntelSchema, prepGuideSchema } from "@/lib/ai/schemas";
import { Tela1Visual } from "@/components/prep/Tela1Visual";
import { PartialPrepBanner } from "@/components/prep/PartialPrepBanner";
import { PrepCompletedTracker } from "@/components/prep/PrepCompletedTracker";
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

  // Check for partial-generation flag — pipeline sets meta.partial=true and
  // populates meta.failed_sections when 3-4 of 5 sections succeeded.
  const guideParsed = data?.prep_guide
    ? prepGuideSchema.safeParse(data.prep_guide)
    : null;
  const isPartial = guideParsed?.success
    ? guideParsed.data.meta.partial === true
    : false;
  const failedSections = guideParsed?.success
    ? (guideParsed.data.meta.failed_sections ?? [])
    : [];

  const sectionCount = guideParsed?.success
    ? guideParsed.data.sections?.length
    : undefined;

  return (
    <>
      {isPartial && <PartialPrepBanner failedSections={failedSections} />}
      {data?.generation_status === "complete" && (
        <PrepCompletedTracker sessionId={id} sectionCount={sectionCount} />
      )}
      <Tela1Visual
        sessionId={id}
        jobDescription={data?.job_description ?? null}
        companyIntel={companyIntel}
        companyIntelStatus={data?.company_intel_status ?? null}
      />
    </>
  );
}
