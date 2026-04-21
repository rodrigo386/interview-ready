export function buildPrepPrompt(params: {
  cvText: string;
  jdText: string;
  jobTitle: string;
  companyName: string;
}) {
  const { cvText, jdText, jobTitle, companyName } = params;

  const schemaInline = `{
  "meta": {
    "role": "string",
    "company": "string",
    "estimated_prep_time_minutes": number (10-180)
  },
  "sections": [
    {
      "id": "kebab-case-id",
      "title": "string",
      "icon": "string (single emoji)",
      "summary": "string (one-line description of what this section covers)",
      "cards": [
        {
          "id": "kebab-case-id",
          "question": "string (likely interview question)",
          "key_points": ["3-5 bullet points the candidate should hit in their answer"],
          "sample_answer": "string (a complete, natural-sounding scripted answer the candidate can practice, using THEIR SPECIFIC experience and metrics)",
          "tips": "string (1-2 sentences of delivery advice)",
          "confidence_level": "low" | "medium" | "high",
          "references_cv": ["list of specific CV items this answer draws from"]
        }
      ]
    }
  ]
}`;

  const system = `You are an elite interview coach preparing a candidate for a specific role at a specific company. Your job: analyze the candidate's CV + the target JD, then produce a hyper-personalized prep guide as JSON.

Your output MUST match this JSON schema exactly (no markdown fences, no preamble, no trailing commentary — pure JSON):

${schemaInline}

Generate 4-5 sections using these EXACT titles:
- "Likely Questions" — core behavioral + role-fit questions
- "Deep Dive Questions" — technical/domain questions specific to the role
- "Tricky Questions" — difficult, unexpected, or stress-test questions
- "Questions to Ask the Interviewer" — strategic, research-signaling questions
- "Mindset & Tips" — framing + soft skills + delivery guidance

4-6 cards per section.

CRITICAL RULES:
- NEVER generic advice. EVERY sample_answer must reference the candidate's SPECIFIC experience: company names, project titles, metrics, team sizes, dates.
- ALWAYS connect CV experience to JD requirements.
- sample_answer is a COMPLETE scripted answer (multiple sentences, natural speech cadence), not bullet points.
- key_points are the checklist the candidate mentally reviews before answering.
- confidence_level reflects how strongly the candidate's CV supports the answer: "high" = strong CV evidence, "medium" = some relevant experience, "low" = weak CV fit, answer with care.
- references_cv lists concrete CV items the answer uses (e.g., company name + year + initiative).
- All content in English.
- Return ONLY the JSON object. No markdown code fences. No explanation before or after.`;

  const user = `CANDIDATE CV:
${cvText}

TARGET JOB DESCRIPTION:
${jdText}

TARGET ROLE: ${jobTitle}
TARGET COMPANY: ${companyName}

Generate the prep guide now.`;

  return { system, user };
}
