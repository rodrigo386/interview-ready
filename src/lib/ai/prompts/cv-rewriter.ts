import type { AtsAnalysis } from "@/lib/ai/schemas";

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
- Output English only

The ATS analysis already identified the top gaps — prioritize those fixes.

Call submit_cv_rewrite exactly once with:
- markdown: full rewritten CV. Use standard sections (Professional Summary, Experience, Skills, Education, Additional Information if relevant). Use ## for section headings, ### for role/job titles under Experience, - for bullet points, **bold** for emphasis when it mirrors the JD.
- summary_of_changes: 3-8 short bullets describing each major rewrite (e.g., "Upgraded 'digital tools' to 'agentic AI' in Bayer bullet")
- preserved_facts: list of specific facts kept verbatim (e.g., "$500M addressable spend at Bayer 2019-2022")`;

  const user = `TARGET ROLE: ${jobTitle}
TARGET COMPANY: ${companyName}

ORIGINAL CV:
${cvText}

JOB DESCRIPTION:
${jobDescription}

TOP FIXES (from ATS analysis — prioritize these):
${fixesBlock}

Rewrite the CV now. Call submit_cv_rewrite.`;

  return { system, user };
}
