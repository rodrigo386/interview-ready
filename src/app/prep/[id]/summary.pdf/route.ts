import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  prepGuideSchema,
  atsAnalysisSchema,
  companyIntelSchema,
} from "@/lib/ai/schemas";
import { buildPrepSummaryPdf } from "@/lib/files/prep-summary-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: session, error } = await supabase
    .from("prep_sessions")
    .select(
      "id, company_name, job_title, prep_guide, ats_analysis, ats_status, company_intel, company_intel_status, job_description",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const guideParsed = prepGuideSchema.safeParse(session.prep_guide);
  if (!guideParsed.success) {
    return NextResponse.json(
      { error: "prep guide not ready" },
      { status: 404 },
    );
  }

  const atsParsed =
    session.ats_status === "complete"
      ? atsAnalysisSchema.safeParse(session.ats_analysis)
      : null;
  const ats = atsParsed?.success ? atsParsed.data : null;

  const intelParsed =
    session.company_intel_status === "complete"
      ? companyIntelSchema.safeParse(session.company_intel)
      : null;
  const intel = intelParsed?.success ? intelParsed.data : null;

  let bytes: Uint8Array;
  try {
    bytes = await buildPrepSummaryPdf({
      company: session.company_name,
      role: session.job_title,
      guide: guideParsed.data,
      ats,
      intel,
      jobDescription: session.job_description ?? null,
    });
  } catch (err) {
    console.error(`[summary-pdf ${id}] generation failed:`, err);
    return NextResponse.json(
      { error: "pdf generation failed" },
      { status: 500 },
    );
  }

  const safeCompany = session.company_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = safeCompany ? `prep-${safeCompany}.pdf` : "prep-resumo.pdf";

  return new Response(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.length),
    },
  });
}
