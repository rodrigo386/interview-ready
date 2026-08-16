import type { Metadata } from "next";
import {
  companyIntelSchema,
  prepGuideSchema,
  salaryBenchmarkSchema,
} from "@/lib/ai/schemas";
import { Tela1Visual } from "@/components/prep/Tela1Visual";
import { PartialPrepBanner } from "@/components/prep/PartialPrepBanner";
import { PrepCompletedTracker } from "@/components/prep/PrepCompletedTracker";
import { loadPrepSession } from "@/lib/prep/load-session";
import { shouldOfferFullPrep } from "@/lib/prep/full-prep";
import { GenerateFullPrepCta } from "@/components/prep/GenerateFullPrepCta";

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

  const salaryParsed =
    data?.salary_benchmark_status === "complete"
      ? salaryBenchmarkSchema.safeParse(data?.salary_benchmark)
      : null;
  const salaryBenchmark = salaryParsed?.success ? salaryParsed.data : null;

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

  // Prep reivindicada da ferramenta ATS anônima: esta é a primeira tela que
  // ela abre pelo dashboard, e sem o guia a Tela 1 fica quase vazia. O CTA
  // usa a mesma decisão da action, então nunca aparece numa prep normal.
  const offerFullPrep = shouldOfferFullPrep({
    generationStatus: data?.generation_status ?? null,
    prepGuide: data?.prep_guide ?? null,
    atsStatus: data?.ats_status ?? null,
    companyIntelStatus: data?.company_intel_status ?? null,
  });

  return (
    <>
      {isPartial && <PartialPrepBanner failedSections={failedSections} />}
      {offerFullPrep && (
        <div className="mb-6">
          <GenerateFullPrepCta sessionId={id} />
        </div>
      )}
      {data?.generation_status === "complete" && (
        <PrepCompletedTracker sessionId={id} sectionCount={sectionCount} />
      )}
      <Tela1Visual
        sessionId={id}
        jobDescription={data?.job_description ?? null}
        companyIntel={companyIntel}
        companyIntelStatus={data?.company_intel_status ?? null}
        salaryBenchmark={salaryBenchmark}
        salaryBenchmarkStatus={data?.salary_benchmark_status ?? null}
      />
    </>
  );
}
