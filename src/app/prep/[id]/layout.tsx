import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { prepGuideSchema } from "@/lib/ai/schemas";
import { PrepShellProvider } from "@/components/prep/PrepShellProvider";
import { PrepStepperBound } from "@/components/prep/PrepStepperBound";
import { PrepBreadcrumb } from "@/components/prep/PrepBreadcrumb";
import { computeServerCompleted } from "@/lib/prep/step-state";
import { PrepSkeleton } from "@/components/prep/PrepSkeleton";
import { PrepFailed } from "@/components/prep/PrepFailed";

export default async function PrepLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select("id, generation_status, prep_guide, error_message, ats_status")
    .eq("id", id)
    .single();

  if (error || !session) notFound();

  if (session.generation_status === "generating" || session.generation_status === "pending") {
    return <PrepSkeleton />;
  }
  if (session.generation_status === "failed") {
    return <PrepFailed id={session.id} errorMessage={session.error_message} />;
  }

  const parsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!parsed.success) {
    return <PrepFailed id={session.id} errorMessage="Stored guide is malformed." />;
  }

  const guideReady = true;
  const atsComplete = session.ats_status === "complete";
  const serverCompleted = computeServerCompleted({ guideReady, atsComplete });

  return (
    <PrepShellProvider
      sessionId={session.id}
      company={parsed.data.meta.company}
      role={parsed.data.meta.role}
      estimatedMinutes={parsed.data.meta.estimated_prep_time_minutes}
      serverCompleted={serverCompleted}
    >
      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 md:py-10">
        <header className="mb-6 flex items-center gap-3 text-sm">
          <PrepBreadcrumb sessionId={session.id} />
        </header>
        <div className="mb-8">
          <PrepStepperBound />
        </div>
        <main>{children}</main>
      </div>
    </PrepShellProvider>
  );
}
