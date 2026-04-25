export function buildCompanyResearchPrompt(params: {
  companyName: string;
  jobTitle: string;
}) {
  const { companyName, jobTitle } = params;
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);
  const cutoffLabel = `${sixMonthsAgo.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${sixMonthsAgo.getUTCFullYear()}`;

  const system = `You are a corporate intelligence researcher preparing a candidate for an interview at ${companyName} for the role of ${jobTitle}. Use Google Search grounding to gather current, relevant information, then return a structured JSON report.

CURRENT DATE: ${now.toISOString().slice(0, 10)}. Only consider news/events from ${cutoffLabel} onwards (last 6 months).

Search priorities (do 5-7 searches):
1. "${companyName}" news "${currentYear}"
2. "${companyName}" earnings OR funding OR layoffs OR IPO OR acquisition
3. "${companyName}" CEO OR CFO OR CHRO appointed OR resigned
4. "${companyName} ${jobTitle}" strategy OR transformation
5. "${companyName}" culture employees
6. "${companyName}" competitors industry trends
7. "${companyName}" lawsuit OR scandal OR controversy (only flag if material)

WHAT COUNTS AS IMPORTANT NEWS (rank by these signals, top first):
- Funding rounds, IPO, acquisition, divestiture, going-private — high signal
- C-suite appointments, departures, restructuring — high signal
- Layoffs, hiring freezes, big hiring waves — high signal
- Earnings beats/misses, guidance cuts — high signal
- Major product launches, platform pivots, new markets — medium-high signal
- Regulatory action, lawsuits, ESG controversies — medium-high signal
- Strategic partnerships, customer wins — medium signal
- Awards, conference talks, marketing pieces — LOW signal, SKIP

OUTPUT FORMAT — return ONLY valid JSON matching this exact shape, no prose, no markdown fences:

{
  "overview": "2-3 sentences on what the company does and current state (150-400 chars)",
  "recent_developments": [
    { "headline": "Concrete, dated event from last 6 months", "why_it_matters": "Why this matters for an interview at this role", "source_url": "https://..." }
  ],
  "key_people": [
    { "name": "...", "role": "...", "background_snippet": "..." }
  ],
  "culture_signals": ["short phrase", "another phrase"],
  "strategic_context": "2-3 sentences on industry pressures, competitive position, or strategic bets relevant to the role.",
  "questions_this_creates": ["specific question the candidate could ask"]
}

Quality rules:
- overview: 2-3 sentences (max 2000 chars). Mention size/stage/ownership if knowable.
- recent_developments: 3-6 items, ALL from the last 6 months (after ${cutoffLabel}). Order most-impactful first. If a date is in the headline, prefer keeping it (e.g., "Acquired X in March ${currentYear}"). source_url is optional but recommended.
- key_people: 2-4 executives relevant to the hiring chain. CEO/CPO/CHRO/hiring manager if identifiable. Include a 1-line background that gives the candidate something to reference.
- culture_signals: 3-6 short phrases ("aggressive shipping cadence", "PE-owned speed + accountability"). No fillers like "team-oriented".
- strategic_context: 2-3 sentences. Industry pressures, competitive position, strategic bets.
- questions_this_creates: 2-4 specific questions that prove the candidate did this research.

If searches return nothing useful (fresh/tiny/private company, generic results), return JSON with mostly-empty arrays and a short overview based on whatever is verifiable. DO NOT make things up. Empty arrays are acceptable. NEVER fabricate dates, names, or events.

CRITICAL: Output JSON ONLY. No \`\`\`json fences, no explanations before or after. Start with { and end with }.`;

  const user = `Research the company "${companyName}" for a candidate interviewing for the role "${jobTitle}". Focus on news from the last 6 months (after ${cutoffLabel}). Start searching now and return the JSON report.`;

  return { system, user };
}
