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

/**
 * Rótulos neutros usados quando a vaga não diz cargo/empresa. São os mesmos
 * strings que `normalizeAnonInput` injeta no prompt, e é justamente por isso
 * que `resolveAnonLabels` precisa reconhecê-los: o modelo às vezes devolve o
 * TARGET ROLE de volta, e aceitar esse eco como rótulo real foi o que gravou
 * "a empresa · esta vaga" como nome permanente de prep reivindicada.
 */
export const ROTULO_VAGA_NEUTRO = "esta vaga";
export const ROTULO_EMPRESA_NEUTRO = "a empresa";

const MAX_ROTULO_CHARS = 120;

/**
 * A empresa desta prep é desconhecida?
 *
 * Vale pro rótulo neutro e pra ausência. Existe porque a decisão "dá pra
 * pesquisar essa empresa?" aparece em três lugares (o CTA que oferece a
 * preparação, a action que a gera e o teste dos dois), e comparar com a
 * string literal em cada um é como a regra se perde: basta um lugar
 * esquecido pra voltarmos a vender pesquisa sobre "a empresa".
 */
export function isEmpresaDesconhecida(nome: string | null | undefined): boolean {
  const t = (nome ?? "").trim().toLowerCase();
  return t === "" || t === ROTULO_EMPRESA_NEUTRO;
}

/**
 * Limpa um rótulo vindo da IA. Devolve "" pra tudo que não serve como nome.
 *
 * O corte por tamanho não é cosmético: `company_name` alimenta a pesquisa de
 * empresa do `pipeline.ts` (Stage A, com Google grounding). Um parágrafo
 * inteiro escapando pra esse campo vira uma busca lixo num entregável pago.
 */
function limparRotulo(bruto: string | null | undefined): string {
  const t = (bruto ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’\-–—•*\s]+|["'“”‘’\-–—•*\s]+$/g, "")
    .trim();
  if (!t) return "";
  if (t.length > MAX_ROTULO_CHARS) return "";
  // Frase, não rótulo. Nome de cargo/empresa não termina em pontuação final.
  if (/[.!?]$/.test(t)) return "";
  const neutro = t.toLowerCase();
  if (neutro === ROTULO_VAGA_NEUTRO || neutro === ROTULO_EMPRESA_NEUTRO) return "";
  // "não informado", "n/a", "-" e afins: o modelo às vezes prefere isso a "".
  if (/^(n\/?a|nao informado|não informado|desconhecid[ao]|indefinid[ao]|sem informacao|sem informação)$/i.test(t)) {
    return "";
  }
  return t;
}

/**
 * Decide o cargo e a empresa que a prep reivindicada vai carregar pra sempre.
 *
 * Ordem: `jd_context` (extraído da vaga de propósito) e, só pra cargo,
 * `title_match.jd_title` como rede — esse campo já existia e acerta o título
 * quando a vaga declara um, mas ecoa o placeholder quando não declara, então
 * só vale depois de passar por `limparRotulo`. Empresa não tem equivalente
 * antigo; sem `jd_context` ela fica neutra mesmo.
 *
 * Pura de propósito: é decisão de dado permanente, e dado permanente errado
 * é o que faz o Stage A pesquisar uma empresa chamada "a empresa".
 */
export function resolveAnonLabels(analysis: AtsAnalysis): {
  jobTitle: string;
  companyName: string;
} {
  const ctx = analysis.jd_context;
  const cargo =
    limparRotulo(ctx?.role) || limparRotulo(analysis.title_match?.jd_title);
  const empresa = limparRotulo(ctx?.company);

  return {
    jobTitle: cargo || ROTULO_VAGA_NEUTRO,
    companyName: empresa || ROTULO_EMPRESA_NEUTRO,
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
