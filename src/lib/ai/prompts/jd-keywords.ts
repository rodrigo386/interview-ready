import { clampJobDescription } from "@/lib/ai/clamp-jd";

/**
 * Extração das palavras-chave da vaga — e SÓ da vaga.
 *
 * Esta chamada não recebe currículo, cargo alvo nem empresa, de propósito:
 * qualquer coisa além do texto da vaga é por onde a contaminação entrava.
 * As regras de faixa são as mesmas do STEP 1 do `ats-analyzer`, copiadas aqui
 * em vez de importadas porque este prompt precisa ser lido sozinho.
 */
export function buildJdKeywordsPrompt(jdText: string) {
  const system = `You extract ATS screening keywords from a job description. You only see the job description; there is no resume.

Return JSON with three arrays of EXACT PHRASES copied verbatim from the job description:
- critical: phrases that appear in (a) the job title OR (b) the responsibilities / "responsabilidades" section AND ALSO in the requirements / "requisitos" section. Max 8.
- high: phrases in responsibilities OR requirements, but not both. Max 8.
- medium: phrases in "nice to have" / "preferred" / "desejável" sections, or mentioned only once. Max 6.

Rules:
- Pick distinctive skills, tools, technologies, methodologies, certifications and domain terms. Never generic words like "experiência", "experience", "liderança", "proatividade", "comunicação".
- Copy the phrase exactly as written in the job description. No synonyms, no translation, no paraphrase.
- A phrase appears in only one tier.
- Keep the job description's language.
- Same job description → same output. Follow the rules mechanically.`;

  const user = `JOB DESCRIPTION:
${clampJobDescription(jdText)}

Extract now.`;

  return { system, user };
}
