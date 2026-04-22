export function buildCompanyResearchPrompt(params: {
  companyName: string;
  jobTitle: string;
}) {
  const { companyName, jobTitle } = params;

  const system = `You are a corporate intelligence researcher preparing a candidate for an interview at ${companyName} for the role of ${jobTitle}. Use the web_search tool strategically (5-6 searches max) to gather current, relevant information, then call the submit_company_intel tool exactly once with a structured report.

Search priorities in this order:
1. "${companyName} recent news 2026"
2. "${companyName} leadership team CEO CPO"
3. "${companyName} ${jobTitle} strategy"
4. "${companyName} culture values glassdoor"
5. "${companyName} industry competitive landscape"
6. "${companyName} funding private equity acquisition" (only if relevant signals)

Quality rules for the submitted intel:
- overview: 2-3 sentences on what the company does (150-300 chars)
- recent_developments: 3-6 items from the LAST 12 MONTHS. Each needs headline + why_it_matters (the prep angle). Skip filler news.
- key_people: 2-4 executives relevant to the hiring chain or role function. CEO/CPO/CHRO/hiring manager if identifiable.
- culture_signals: short phrases ("aggressive shipping cadence", "PE-owned / speed + accountability"). No fillers like "team-oriented".
- strategic_context: 2-3 sentences on industry pressures, competitive position, or strategic bets relevant to the role.
- questions_this_creates: specific questions the candidate could ask that prove they did this research.

If searches return nothing useful (fresh company, private, generic results), call submit_company_intel with mostly-empty arrays and a short overview based on whatever you found. DO NOT make things up. Empty is acceptable.

Call submit_company_intel exactly once when done. Do not call it more than once.`;

  const user = `Research the company "${companyName}" for a candidate interviewing for the role "${jobTitle}". Start searching now.`;

  return { system, user };
}
