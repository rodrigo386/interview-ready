import type { AtsAnalysis } from "@/lib/ai/schemas";
import { clampJobDescription } from "@/lib/ai/clamp-jd";

export function buildCvRewritePrompt(params: {
  cvText: string;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  topFixes: AtsAnalysis["top_fixes"];
}) {
  const { cvText, jobDescription, jobTitle, companyName, topFixes } = params;

  const fixesBlock = topFixes
    .map(
      (f) =>
        `${f.priority}. ${f.gap}\n   CV says: ${f.original_cv_language || "(absent)"}\n   JD says: ${f.jd_language}\n   Suggested: ${f.suggested_rewrite}`,
    )
    .join("\n\n");

  const system = `You are rewriting a CV to maximize ATS match with a specific job description. Your goal: upgrade vocabulary to mirror the JD's exact phrasing without inventing any new facts.

HARD RULES:
- NEVER invent jobs, roles, metrics, dates, or education credentials
- NEVER inflate scope (if CV says $100M, don't write $300M)
- Mirror the JD's EXACT phrases when filling gaps — if JD says "touchless P2P", use that exact phrase, not "automated purchase order processing"
- Keep the candidate's narrative arc — don't reorder years or invent transitions
- Keep the same approximate length as the original (±20%)
- LANGUAGE: write the CV in the language of the JOB DESCRIPTION. If the JD is too short or ambiguous to tell, use the language of the ORIGINAL CV. Never translate into English a CV written in Portuguese. Keep proper nouns, company names and tool names (SAP, Consinco) as they are.

The ATS analysis already identified the top gaps — prioritize those fixes.

Call submit_cv_rewrite exactly once with:
- markdown: full rewritten CV. Use standard sections, with headings in the CV language: in English "Professional Summary", "Experience", "Skills", "Education", "Additional Information"; in Brazilian Portuguese "Resumo Profissional", "Experiência Profissional", "Competências", "Formação Acadêmica", "Informações Adicionais". Use ## for section headings, ### for role/job titles under Experience, - for bullet points, **bold** for emphasis when it mirrors the JD.
- summary_of_changes: 3-8 short bullets, ALWAYS in Brazilian Portuguese (the reader is a Brazilian job seeker), describing each major rewrite (e.g., "Upgraded 'digital tools' to 'agentic AI' in Bayer bullet")
- preserved_facts: list of specific facts kept verbatim, in Brazilian Portuguese (e.g., "$500M addressable spend at Bayer 2019-2022")`;

  const user = `TARGET ROLE: ${jobTitle}
TARGET COMPANY: ${companyName}

ORIGINAL CV:
${cvText}

JOB DESCRIPTION:
${clampJobDescription(jobDescription)}

TOP FIXES (from ATS analysis — prioritize these):
${fixesBlock}

Rewrite the CV now. Call submit_cv_rewrite.`;

  return { system, user };
}
