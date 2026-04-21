import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema, atsAnalysisSchema } from "@/lib/ai/schemas";
import { PrepGuide } from "@/components/prep/PrepGuide";
import { PrepFailed } from "@/components/prep/PrepFailed";
import { PrepSkeleton } from "@/components/prep/PrepSkeleton";
import { AtsCtaCard } from "@/components/prep/AtsCtaCard";
import { AtsScoreCard } from "@/components/prep/AtsScoreCard";
import { AtsFailed } from "@/components/prep/AtsFailed";
import { AtsSkeleton } from "@/components/prep/AtsSkeleton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("prep_sessions")
    .select("generation_status")
    .eq("id", id)
    .single();

  const isGenerating =
    data?.generation_status === "generating" ||
    data?.generation_status === "pending";

  return {
    title: "Prep — InterviewReady",
    other: isGenerating
      ? { "http-equiv": "refresh", content: "3" }
      : {},
  };
}

export default async function PrepViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string; card?: string }>;
}) {
  const { id } = await params;
  const { section, card } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select("id, generation_status, prep_guide, error_message, ats_status, ats_analysis, ats_error_message")
    .eq("id", id)
    .single();

  if (error || !session) {
    notFound();
  }

  if (session.generation_status === "generating" || session.generation_status === "pending") {
    return <PrepSkeleton />;
  }

  if (session.generation_status === "failed") {
    return <PrepFailed id={session.id} errorMessage={session.error_message} />;
  }

  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) {
    console.error("[prep/view] stored guide failed schema:", parsed.error);
    return <PrepFailed id={session.id} errorMessage="Stored guide is malformed." />;
  }

  const ats = renderAtsBlock(session);
  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-10">{ats}</div>
      <PrepGuide
        guide={parsed.data}
        sessionId={session.id}
        activeSectionId={section}
        activeCardId={card}
      />
    </>
  );
}

function renderAtsBlock(session: {
  id: string;
  ats_status: string | null;
  ats_analysis: unknown;
  ats_error_message: string | null;
}) {
  if (session.ats_status === "generating") return <AtsSkeleton />;
  if (session.ats_status === "failed") {
    return <AtsFailed sessionId={session.id} errorMessage={session.ats_error_message} />;
  }
  if (session.ats_status === "complete") {
    const parsed = atsAnalysisSchema.safeParse(session.ats_analysis);
    if (!parsed.success) {
      return <AtsFailed sessionId={session.id} errorMessage="Stored analysis is malformed." />;
    }
    return <AtsScoreCard analysis={parsed.data} />;
  }
  return <AtsCtaCard sessionId={session.id} />;
}
