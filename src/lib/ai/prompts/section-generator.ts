import { prepSectionSchema } from "@/lib/ai/schemas";
import { z } from "zod";
import type { CompanyIntel } from "@/lib/ai/schemas";

// Runtime type of a PrepSection (import to reuse)
export type SectionKind =
  | "likely"
  | "deep-dive"
  | "tricky"
  | "questions-to-ask"
  | "mindset";

type SectionBrief = {
  id: string;
  title: string;
  icon: string;
  focus: string;
  num_cards: number;
};

const SECTION_BRIEFS: Record<SectionKind, SectionBrief> = {
  likely: {
    id: "likely-questions",
    title: "Likely Questions",
    icon: "💬",
    focus:
      "Core behavioral and role-fit questions an interviewer is most likely to open with. Think motivation, strengths, achievements, and a single 'tell me about yourself' angle.",
    num_cards: 3,
  },
  "deep-dive": {
    id: "deep-dive-questions",
    title: "Deep Dive Questions",
    icon: "🔍",
    focus:
      "Technical and domain-specific questions tied to the role's responsibilities. Examples: how the candidate would approach the first 90 days, complex projects they've led, decision frameworks they use.",
    num_cards: 3,
  },
  "questions-to-ask": {
    id: "questions-to-ask",
    title: "Questions to Ask the Interviewer",
    icon: "❓",
    focus:
      "Strategic questions the candidate should ask that signal research and judgement. Each card's 'question' is the candidate's question; sample_answer is coaching on WHY to ask it and what signal to listen for.",
    num_cards: 3,
  },
  "tricky": {
    id: "tricky-questions",
    title: "Tricky Questions",
    icon: "🎯",
    focus:
      "Difficult, unexpected, or stress-test questions. Examples: why leaving current role, what would you do differently from the previous person in this role, weakness with real mitigation, 'sell me this pen'-style curveballs, handling bad news or pushback. Each card must feel realistic and grounded in the candidate's actual risk areas given their CV.",
    num_cards: 3,
  },
  "mindset": {
    id: "mindset-tips",
    title: "Mindset & Tips",
    icon: "🧠",
    focus:
      "Framing, soft skills, and delivery advice specific to this candidate and role. Examples: how to frame their value vs. lower-cost candidates, pacing for a 45-minute interview, what to emphasize vs. downplay given the CV, video-call setup tips, recovery from a wobble mid-interview. Each card's 'question' is a situation/topic, 'sample_answer' is the coaching they need.",
    num_cards: 3,
  },
};

export function buildSectionPrompt(params: {
  kind: SectionKind;
  cvText: string;
  jdText: string;
  jobTitle: string;
  companyName: string;
  companyIntel?: CompanyIntel | null;
}) {
  const brief = SECTION_BRIEFS[params.kind];
  const intelBlock = params.companyIntel
    ? renderIntelBlock(params.companyIntel)
    : "";

  const intelGuidance = params.companyIntel
    ? `\n\nIf COMPANY INTELLIGENCE is provided, weave specific facts (names, dates, strategic bets) into at least 2 of your sample_answers. Do not fabricate facts beyond what is provided.`
    : "";

  const system = `You are an elite interview coach generating ONE section of a prep guide for a specific candidate applying to a specific role.

Section focus: ${brief.focus}

You MUST call the submit_section tool with exactly ${brief.num_cards} cards.

Rules per card:
- question: the likely interview question (or for "Questions to Ask", the question the candidate should ask)
- key_points: 3-4 bullets, each ≤ 15 words, that the candidate hits in their answer
- sample_answer: 3-4 sentences (60-100 words) of natural conversational scripted answer, using SPECIFIC details from the candidate's CV — company names, metrics, project titles
- tips: ONE sentence (≤ 25 words) of delivery advice
- confidence_level: "high" if CV strongly supports the answer, "medium" if partial, "low" if weak
- references_cv: 1-3 concrete CV items the answer draws from (company + year + initiative)

NEVER give generic advice. ALWAYS reference the candidate's specific experience.${intelGuidance}

Use these fixed values for the section:
- id: "${brief.id}"
- title: "${brief.title}"
- icon: "${brief.icon}"
- summary: one sentence (≤ 20 words) describing what this section covers

Call submit_section now.`;

  const user = `CANDIDATE CV:
${params.cvText}

TARGET JOB DESCRIPTION:
${params.jdText}

TARGET ROLE: ${params.jobTitle}
TARGET COMPANY: ${params.companyName}${intelBlock}`;

  return { system, user, brief };
}

function renderIntelBlock(intel: CompanyIntel): string {
  const devs = intel.recent_developments
    .map((d) => `- ${d.headline}: ${d.why_it_matters}`)
    .join("\n");
  const people = intel.key_people
    .map((p) => `- ${p.name} (${p.role}): ${p.background_snippet}`)
    .join("\n");
  const culture = intel.culture_signals.join(", ");
  return `

COMPANY INTELLIGENCE (use these specific facts in your answers):

Overview: ${intel.overview}

Recent developments:
${devs || "(none)"}

Key people:
${people || "(none)"}

Culture signals: ${culture || "(none)"}

Strategic context: ${intel.strategic_context}`;
}

export const SECTION_KINDS: SectionKind[] = [
  "likely",
  "deep-dive",
  "tricky",
  "questions-to-ask",
  "mindset",
];
