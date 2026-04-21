import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import {
  prepSectionSchema,
  type PrepSection,
} from "@/lib/ai/schemas";
import { type SectionKind } from "@/lib/ai/prompts/section-generator";

const MODEL_ID = "claude-sonnet-4-5";

/** Full PrepSection fixtures used when MOCK_ANTHROPIC=1. */
const MOCK_SECTIONS: Record<SectionKind, PrepSection> = {
  likely: {
    id: "likely-questions",
    title: "Likely Questions",
    icon: "💬",
    summary: "Core behavioral and role-fit questions.",
    cards: [
      {
        id: "why-this-role",
        question: "Why are you interested in this role?",
        key_points: [
          "Fit with CV and specific experience",
          "Company mission alignment",
          "Growth trajectory in the role",
        ],
        sample_answer:
          "I've been following Mock Co's work for the last year. Given my experience leading procurement transformation at Prior Co, I see strong alignment with the role's focus on AI-native sourcing. The addressable spend scale matches what I've delivered before, and the three-pillar operating model excites me.",
        tips: "Lead with a specific company fact, then tie to your experience.",
        confidence_level: "high",
        references_cv: ["Prior Co 2019-2022 digital transformation"],
      },
      {
        id: "greatest-achievement",
        question: "What's your greatest professional achievement?",
        key_points: ["STAR format", "Quantified impact", "Personal role"],
        sample_answer:
          "At Prior Co I led a digital procurement transformation that cut cycle time by 40% and saved $30M over two years. My role was defining the target operating model and leading the rollout across LATAM.",
        tips: "Use STAR. End with the metric.",
        confidence_level: "high",
        references_cv: ["Prior Co $30M savings", "LATAM rollout 2020-2022"],
      },
      {
        id: "biggest-failure",
        question: "Tell me about a time you failed.",
        key_points: [
          "Real failure",
          "Lesson learned",
          "What you would do differently",
        ],
        sample_answer:
          "Early in my time at Prior Co I pushed a central sourcing model too aggressively without piloting. Adoption stalled. I pulled back, ran a 90-day pilot with one BU, incorporated the feedback, and relaunched — ending at 85% adoption.",
        tips: "Own the failure. Don't blame the team.",
        confidence_level: "medium",
        references_cv: ["Prior Co central sourcing pilot"],
      },
    ],
  },
  "deep-dive": {
    id: "deep-dive-questions",
    title: "Deep Dive Questions",
    icon: "🔍",
    summary: "Technical and domain questions tied to the role.",
    cards: [
      {
        id: "first-90-days",
        question: "How would you approach the first 90 days in this role?",
        key_points: ["Listen tour", "Stakeholder map", "Early wins"],
        sample_answer:
          "First 30 days, I would run a listening tour with the top 20 stakeholders and review the current spend baseline. Days 31-60, I would draft the target operating model and identify 2-3 early wins. Days 61-90, I would pilot one capability and start the hiring plan.",
        tips: "Show a structured cadence, not just activities.",
        confidence_level: "high",
        references_cv: ["Prior Co 90-day plan template"],
      },
      {
        id: "complex-transformation",
        question: "Walk me through a complex transformation you led.",
        key_points: ["Baseline", "Strategic choices", "Results"],
        sample_answer:
          "At Prior Co, we had a fragmented sourcing function across 12 LATAM countries with $500M in addressable spend. I led a 24-month transformation consolidating 4 ERP instances, building a central COE, and deploying an e-sourcing platform. Result: 18% cost takeout, 40% cycle-time reduction.",
        tips: "Narrative arc: baseline, bet, execution, result.",
        confidence_level: "high",
        references_cv: ["Prior Co LATAM transformation"],
      },
      {
        id: "measure-success",
        question: "How do you measure success for an AI-driven team?",
        key_points: ["Value metrics", "Adoption", "Quality"],
        sample_answer:
          "Three layers. Value: dollars saved per requisition, cycle time, touchless P2P rate. Adoption: percent of spend running through AI sourcing agents, stakeholder NPS. Quality: risk coverage, compliance audit findings. I tie team bonus to the value layer.",
        tips: "Avoid vanity metrics.",
        confidence_level: "medium",
        references_cv: ["Prior Co KPI framework"],
      },
    ],
  },
  "questions-to-ask": {
    id: "questions-to-ask",
    title: "Questions to Ask the Interviewer",
    icon: "❓",
    summary: "Strategic questions that signal research and judgement.",
    cards: [
      {
        id: "first-year-success",
        question: "What does success look like in the first 12 months of this role?",
        key_points: ["Sets the bar", "Shows goal orientation"],
        sample_answer:
          "A great opener. Follow up with: 'And what are the blockers you foresee to getting there?' — this gives you intel on what capacity they assume you will have.",
        tips: "Always follow up with the blockers question.",
        confidence_level: "high",
        references_cv: [],
      },
      {
        id: "team-interface",
        question: "How does this team interface with Finance and IT?",
        key_points: ["Org dynamics", "Budget authority"],
        sample_answer:
          "Listen for whether Procurement is a cost center or a strategic function, and whether IT has budget authority over tools. This tells you how much runway you will have as a leader.",
        tips: "Good intel question for second-round interviews.",
        confidence_level: "high",
        references_cv: [],
      },
      {
        id: "board-view",
        question: "What is the board's view on investment in this function?",
        key_points: ["Strategic awareness", "Exec support"],
        sample_answer:
          "This signals you think at the investment-committee level. Save for final-round when you are talking to executives or board members directly.",
        tips: "Save for final round.",
        confidence_level: "medium",
        references_cv: [],
      },
    ],
  },
};

/** JSON Schema for Anthropic tool_use. Matches prepSectionSchema. */
const sectionToolSchema = {
  type: "object" as const,
  required: ["id", "title", "icon", "summary", "cards"],
  properties: {
    id: { type: "string" as const },
    title: { type: "string" as const, minLength: 1 },
    icon: { type: "string" as const, minLength: 1, maxLength: 4 },
    summary: { type: "string" as const },
    cards: {
      type: "array" as const,
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object" as const,
        required: [
          "id",
          "question",
          "key_points",
          "sample_answer",
          "tips",
          "confidence_level",
          "references_cv",
        ],
        properties: {
          id: { type: "string" as const },
          question: { type: "string" as const, minLength: 1 },
          key_points: {
            type: "array" as const,
            minItems: 1,
            maxItems: 8,
            items: { type: "string" as const },
          },
          sample_answer: { type: "string" as const, minLength: 50 },
          tips: { type: "string" as const },
          confidence_level: {
            type: "string" as const,
            enum: ["low", "medium", "high"],
          },
          references_cv: {
            type: "array" as const,
            items: { type: "string" as const },
          },
        },
      },
    },
  },
};

/**
 * Generate ONE prep section via Anthropic tool_use. Throws on error.
 * If MOCK_ANTHROPIC=1, returns fixture immediately.
 */
export async function generateSection(params: {
  kind: SectionKind;
  system: string;
  user: string;
}): Promise<PrepSection> {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return MOCK_SECTIONS[params.kind];
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const start = Date.now();
  console.log(`[anthropic] section ${params.kind} starting`);
  const response = await client.messages.create(
    {
      model: MODEL_ID,
      max_tokens: 2500,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
      tools: [
        {
          name: "submit_section",
          description:
            "Submit the generated prep section matching the required schema.",
          input_schema: sectionToolSchema,
        },
      ],
      tool_choice: { type: "tool", name: "submit_section" },
    },
    { timeout: 120_000 },
  );
  console.log(
    `[anthropic] section ${params.kind} completed in ${Date.now() - start}ms stop_reason=${response.stop_reason} output_tokens=${response.usage?.output_tokens ?? "?"}`,
  );

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Claude did not call submit_section tool. stop_reason=${response.stop_reason}`,
    );
  }

  // tool_use.input is already parsed JSON matching our schema.
  // Validate with Zod as defense-in-depth.
  return prepSectionSchema.parse(toolUse.input);
}
