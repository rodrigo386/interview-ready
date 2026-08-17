import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cvRewriteSchema } from "@/lib/ai/schemas";
import { mdToDocx } from "@/lib/files/md-to-docx";
import { decideCvRewriteDownload } from "@/lib/prep/cv-rewrite-gate";

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
    .select("id, company_name, cv_rewrite, cv_rewrite_status, prep_guide")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Gate de receita (Task 10, rodada 1): BAIXAR exige só `prep_guide` (pagou
  // a preparação completa) + `cv_rewrite_status === "complete"` (o arquivo
  // existe). NÃO exige `ats_status` — diferente do gate de GERAR
  // (`decideCvRewriteGeneration`), porque "↻ Rerodar análise" grava
  // ats_status generating/failed sem apagar um rewrite já pronto, e baixar
  // algo que já existe não devia quebrar por isso. Sem `prep_guide` aqui,
  // uma prep legada com reescrita gerada antes deste gate continuaria
  // baixável por URL direta — a brecha que esta task fecha.
  const access = decideCvRewriteDownload({
    prepGuide: session.prep_guide,
    cvRewriteStatus: session.cv_rewrite_status,
  });
  if (access.kind !== "allowed") {
    return NextResponse.json(
      { error: "rewrite not ready" },
      { status: 404 },
    );
  }

  const parsed = cvRewriteSchema.safeParse(session.cv_rewrite);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "stored rewrite is malformed" },
      { status: 500 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = await mdToDocx(parsed.data.markdown);
  } catch (err) {
    console.error(`[cv-rewrite-docx ${id}] conversion failed:`, err);
    return NextResponse.json(
      { error: "conversion failed" },
      { status: 500 },
    );
  }

  const safeCompany = session.company_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = safeCompany ? `${safeCompany}-cv.docx` : "interview-ready-cv.docx";

  const body = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
