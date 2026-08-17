import type { AtsAnalysis } from "@/lib/ai/schemas";

/**
 * Teto do arquivo enviado, em bytes. Igual ao do upload logado
 * (`prep/new/cv-actions.ts`) e ao `experimental.serverActions.bodySizeLimit`
 * do `next.config.ts` — os três têm que casar: um limite de body menor que o
 * validado faz a server action estourar ANTES de rodar, e aí não existe
 * `state.error` pra mostrar; o usuário só vê o botão voltar ao normal como se
 * nada tivesse acontecido.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "5 MB";

export const MAX_CV_CHARS = 20_000;
export const MAX_JD_CHARS = 20_000;
const MIN_CV_CHARS = 40;
const EXPIRY_DAYS = 7;

export type NormalizedAnonInput = {
  cvText: string;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
};

export function normalizeAnonInput(input: {
  cvText: string;
  jobDescription: string;
  jobTitle?: string;
  companyName?: string;
}):
  | { ok: true; value: NormalizedAnonInput }
  | { ok: false; error: string } {
  const cvText = (input.cvText ?? "").trim().slice(0, MAX_CV_CHARS);
  const jobDescription = (input.jobDescription ?? "").trim().slice(0, MAX_JD_CHARS);

  if (!cvText) return { ok: false, error: "Envie ou cole o seu currículo." };
  if (cvText.length < MIN_CV_CHARS) {
    return {
      ok: false,
      error: "O texto do currículo ficou curto demais. Confira o arquivo e tente de novo.",
    };
  }
  if (!jobDescription) {
    return { ok: false, error: "Cole a descrição da vaga." };
  }

  return {
    ok: true,
    value: {
      cvText,
      jobDescription,
      // Rótulos neutros: o prompt de ATS exige os dois campos, e o anônimo
      // não preenche nenhum deles.
      jobTitle: (input.jobTitle ?? "").trim() || "esta vaga",
      companyName: (input.companyName ?? "").trim() || "a empresa",
    },
  };
}

export function expiresAtFrom(created: Date): string {
  return new Date(created.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Expiração avaliada na leitura — não depende de cron. */
export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() < now.getTime();
}

export type PrepSessionInsert = {
  user_id: string;
  cv_text: string;
  job_description: string;
  job_title: string;
  company_name: string;
  language: string;
  prep_guide: null;
  generation_status: "pending";
  ats_analysis: AtsAnalysis;
  ats_status: "complete";
};

/**
 * Copia a análise anônima para dentro da conta. NUNCA re-executa a IA: rodar
 * de novo arriscaria mudar a nota entre "antes" e "depois" do cadastro — e a
 * nota é a isca. Até 2026-08-16 essa regra também impedia um risco maior: o
 * lado anônimo rodava em Cerebras e o logado em Gemini, dois modelos
 * diferentes que quase certamente dariam notas diferentes (Cerebras foi
 * removido — ver CLAUDE.md §10 — os dois lados rodam em Gemini agora, mas a
 * política de nunca re-executar continua valendo).
 */
export function anonAnalysisToPrepSession(
  row: {
    cv_text: string;
    job_description: string;
    job_title: string | null;
    company_name: string | null;
    analysis: AtsAnalysis;
  },
  userId: string,
): PrepSessionInsert {
  return {
    user_id: userId,
    cv_text: row.cv_text,
    job_description: row.job_description,
    job_title: row.job_title ?? "esta vaga",
    company_name: row.company_name ?? "a empresa",
    language: "pt-br",
    prep_guide: null,
    generation_status: "pending",
    ats_analysis: row.analysis,
    ats_status: "complete",
  };
}
