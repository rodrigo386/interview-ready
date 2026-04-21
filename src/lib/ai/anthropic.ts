import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { PrepGuide } from "./schemas";

const MOCK_PREP_GUIDE: PrepGuide = {
  meta: {
    role: "Mock Role",
    company: "Mock Co",
    estimated_prep_time_minutes: 30,
  },
  sections: [
    {
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
            "I've been following Mock Co's work for the last year. Given my experience leading procurement transformation at Prior Co, I see strong alignment with the role's focus on AI-native sourcing. In particular, the addressable spend scale matches what I've delivered before, and the three-pillar operating model excites me.",
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
          key_points: ["Real failure", "Lesson learned", "What you'd do differently"],
          sample_answer:
            "Early in my time at Prior Co I pushed a central sourcing model too aggressively without piloting. Adoption stalled. I pulled back, ran a 90-day pilot with one BU, incorporated the feedback, and relaunched — ending at 85% adoption.",
          tips: "Own the failure. Don't blame the team.",
          confidence_level: "medium",
          references_cv: ["Prior Co central sourcing pilot"],
        },
        {
          id: "strengths",
          question: "What are your key strengths?",
          key_points: ["Technical + soft split", "Backed by examples", "Role-relevant"],
          sample_answer:
            "Two strengths: first, connecting digital capability to business outcome — I don't just deploy tools, I redesign processes so the tools actually deliver value. Second, cross-functional leadership — I've led teams spanning finance, IT, and operations on $100M+ initiatives.",
          tips: "Pick two, not five.",
          confidence_level: "high",
          references_cv: ["Prior Co cross-functional leadership"],
        },
      ],
    },
    {
      id: "deep-dive",
      title: "Deep Dive Questions",
      icon: "🔍",
      summary: "Technical and domain questions.",
      cards: [
        {
          id: "deep-1",
          question: "How would you approach the first 90 days in this role?",
          key_points: ["Listen/observe/design cadence", "Stakeholder map", "Early wins"],
          sample_answer:
            "First 30 days, I would run a listening tour with the top 20 stakeholders and review the current spend baseline. Days 31-60, I'd draft the target operating model and identify 2-3 early wins. Days 61-90, I'd pilot one capability and start the hiring plan.",
          tips: "Show a structured cadence, not just activities.",
          confidence_level: "high",
          references_cv: ["Prior Co 90-day plan template"],
        },
        {
          id: "deep-2",
          question: "Walk me through a complex procurement transformation you led.",
          key_points: ["Starting baseline", "Strategic choices", "Execution challenges", "Results"],
          sample_answer:
            "At Prior Co, we had a fragmented sourcing function across 12 LATAM countries with $500M in addressable spend and no central data. I led a 24-month transformation consolidating 4 ERP instances, building a central COE, and deploying an e-sourcing platform. Biggest challenge: change management with country GMs who owned the spend. We overcame it with quarterly value-share reviews. Result: 18% cost takeout.",
          tips: "Narrative arc — baseline, bet, execution, result.",
          confidence_level: "high",
          references_cv: ["Prior Co LATAM transformation"],
        },
        {
          id: "deep-3",
          question: "How do you measure success for an AI-driven procurement team?",
          key_points: ["Value metrics", "Adoption metrics", "Quality metrics"],
          sample_answer:
            "Three layers. Value: $ savings per requisition, cycle time, touchless P2P rate. Adoption: % of spend running through AI sourcing agents, stakeholder NPS. Quality: risk coverage, compliance audit findings. I tie team bonus to the value layer.",
          tips: "Avoid vanity metrics.",
          confidence_level: "medium",
          references_cv: ["Prior Co KPI framework"],
        },
        {
          id: "deep-4",
          question: "Describe your approach to building an AI-native team.",
          key_points: ["Hybrid skills", "Career paths", "Hiring principles"],
          sample_answer:
            "I build for hybrid skills — procurement domain knowledge plus AI fluency. I've created career pathways for three archetypes: category managers who upskill on AI tools, data scientists embedded in pods, and platform engineers for the P2P backbone. Hiring principle: curiosity over credentials.",
          tips: "Show the org chart thinking.",
          confidence_level: "medium",
          references_cv: ["Prior Co talent model"],
        },
      ],
    },
    {
      id: "tricky-questions",
      title: "Tricky Questions",
      icon: "🎯",
      summary: "Stress-test and unexpected questions.",
      cards: [
        {
          id: "tricky-1",
          question: "Why are you leaving your current role?",
          key_points: ["Forward-looking", "No blame", "Tie to new role"],
          sample_answer:
            "I've built what I wanted to build at Prior Co. The next chapter I'm chasing is AI-native transformation at scale, which is exactly what this role is about. Prior Co's next wave is operational optimization, and that's a different challenge than the one I want.",
          tips: "Never bad-mouth. Always forward.",
          confidence_level: "medium",
          references_cv: [],
        },
        {
          id: "tricky-2",
          question: "Our last director didn't work out. What would be different about you?",
          key_points: ["Humility", "Specific capability gaps you'd fill", "Collaboration style"],
          sample_answer:
            "I can't know what didn't work without more context, but what I'd bring: a clear 90-day plan, explicit stakeholder contracts on day 30, and a bias toward quick pilots over big launches. If there were execution challenges, that's my wheelhouse.",
          tips: "Show self-awareness. Don't overpromise.",
          confidence_level: "medium",
          references_cv: ["Prior Co 90-day plan template"],
        },
        {
          id: "tricky-3",
          question: "What's your weakness?",
          key_points: ["Real weakness", "Active mitigation", "Not a humble-brag"],
          sample_answer:
            "I tend to over-invest in building consensus before deciding. I've mitigated it by giving myself a decision deadline on key calls — if I don't have 80% alignment in two weeks, I decide and move. It's made me faster.",
          tips: "Pick one real thing. Show the mitigation.",
          confidence_level: "medium",
          references_cv: [],
        },
      ],
    },
    {
      id: "questions-to-ask",
      title: "Questions to Ask the Interviewer",
      icon: "❓",
      summary: "Strategic questions that signal research and judgment.",
      cards: [
        {
          id: "q-ask-1",
          question: "What does success look like in the first 12 months of this role?",
          key_points: ["Sets the bar", "Shows goal orientation"],
          sample_answer:
            "A great opener. Follow up with: 'And what are the blockers you foresee to getting there?' — this gives you intel on what capacity they assume you'll have.",
          tips: "Always follow up with the blockers question.",
          confidence_level: "high",
          references_cv: [],
        },
        {
          id: "q-ask-2",
          question: "How does the AI + Digital Procurement team interface with Finance and IT?",
          key_points: ["Reveals org dynamics", "Specific to role"],
          sample_answer:
            "Listen for: is Procurement a cost center or a strategic function? Does IT have budget authority over tools? This tells you how much runway you'll have as a leader.",
          tips: "Good intel question for second-round interviews.",
          confidence_level: "high",
          references_cv: [],
        },
        {
          id: "q-ask-3",
          question: "What's the board's view on AI investment in non-core functions?",
          key_points: ["Shows strategic awareness", "Gauges exec support"],
          sample_answer:
            "This signals you think at the investment-committee level. Save for final-round when you're talking to executives or board members directly.",
          tips: "Save for final round.",
          confidence_level: "medium",
          references_cv: [],
        },
      ],
    },
    {
      id: "mindset",
      title: "Mindset & Tips",
      icon: "🧠",
      summary: "Framing and delivery advice.",
      cards: [
        {
          id: "mindset-1",
          question: "How to frame your value vs. lower-cost candidates",
          key_points: ["Lead with outcomes", "Speed-to-value", "Risk-adjusted"],
          sample_answer:
            "You're more expensive than a newly-promoted director. Your case: you've done this transformation before, you can de-risk the first 12 months, and your pattern library means no 3-month ramp. Quantify it: 'I'm effectively 6 months of execution you don't have to pay for.'",
          tips: "Own the premium.",
          confidence_level: "high",
          references_cv: ["Prior Co transformation experience"],
        },
        {
          id: "mindset-2",
          question: "Pacing for a 45-minute interview",
          key_points: ["STAR tight", "Buy time with a framework", "Mind the clock"],
          sample_answer:
            "Keep each STAR under 90 seconds. When you need a moment, say 'Let me frame this with three angles' — gives you time to think. Leave 5 minutes for your questions at the end.",
          tips: "Practice your two best STARs out loud.",
          confidence_level: "medium",
          references_cv: [],
        },
        {
          id: "mindset-3",
          question: "What to wear / set up (video)",
          key_points: ["Ring light", "Camera height", "Plain background"],
          sample_answer:
            "Camera at eye level, ring light in front of you, plain wall or bookshelf behind. Business casual — one step above what the interviewer wears. Test Zoom in advance and have a backup on phone.",
          tips: "Test the setup 30 min before.",
          confidence_level: "high",
          references_cv: [],
        },
      ],
    },
  ],
};

export async function createPrepGuide(params: {
  system: string;
  user: string;
}): Promise<string> {
  if (process.env.MOCK_ANTHROPIC === "1") {
    return JSON.stringify(MOCK_PREP_GUIDE);
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    },
    { timeout: 90_000 },
  );

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
