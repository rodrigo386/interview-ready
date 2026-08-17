import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mergeCvs } from "@/lib/profile/cv-merge";
import type { AiRewriteRow, UploadedCvRow } from "@/lib/profile/types";
import { CvRow } from "./CvRow";
import {
  deleteUploadedCv,
  renameUploadedCv,
  deleteAiCvRewrite,
} from "@/app/(app)/profile/actions";

export async function CvList() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [uploadedRes, rewritesRes] = await Promise.all([
    supabase
      .from("cvs")
      .select("id, file_name, display_name, file_size_bytes, mime_type, created_at")
      .eq("user_id", auth.user.id),
    // As duas condições são exatamente o `decideCvRewriteDownload`
    // (`src/lib/prep/cv-rewrite-gate.ts`): `prep_guide` não nulo (marca de
    // preparação completa paga) + reescrita pronta. Ficam como predicado de
    // query em vez de filtro em memória porque `prep_guide` é um jsonb grande
    // — trazer a coluna inteira só pra checar nulidade seria caro.
    //
    // Sem o `.not("prep_guide", "is", null)` esta lista mostrava linhas que a
    // rota de download recusa: uma prep reivindicada da ferramenta ATS
    // anônima com reescrita legada apareceria aqui com o botão "Baixar"
    // levando a 404. Hoje isso não atinge nenhuma linha em produção — o gate
    // de geração já exige `prep_guide` —, mas listar por um critério mais
    // frouxo que o do download é a forma de a divergência voltar em silêncio.
    supabase
      .from("prep_sessions")
      .select("id, company_name, job_title, cv_rewrite_status, updated_at")
      .eq("user_id", auth.user.id)
      .eq("cv_rewrite_status", "complete")
      .not("prep_guide", "is", null),
  ]);

  const list = mergeCvs(
    (uploadedRes.data ?? []) as UploadedCvRow[],
    (rewritesRes.data ?? []) as AiRewriteRow[],
  );

  if (list.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-text-secondary">
        Você ainda não tem CVs.{" "}
        <Link href="/prep/new" className="text-brand-600 underline">
          Criar meu primeiro prep
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {list.map((cv) => (
        <CvRow
          key={cv.origin === "upload" ? `u:${cv.id}` : `a:${cv.prepSessionId}`}
          cv={cv}
          deleteUpload={deleteUploadedCv}
          rename={renameUploadedCv}
          deleteAi={deleteAiCvRewrite}
        />
      ))}
    </ul>
  );
}
