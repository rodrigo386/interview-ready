import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { PrepGuide } from "@/components/prep/PrepGuide";
import { PrepFailed } from "@/components/prep/PrepFailed";
import { PrepSkeleton } from "@/components/prep/PrepSkeleton";

export default async function PrepViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { section } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select("id, generation_status, prep_guide, error_message")
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

  return (
    <PrepGuide
      guide={parsed.data}
      sessionId={session.id}
      activeSectionId={section}
    />
  );
}
