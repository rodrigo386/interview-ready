# InterviewReady — AI-Powered Interview Prep SaaS

## Architecture & Claude Code Instructions

---

## 1. Product Vision

**InterviewReady** transforms any job description + CV into a personalized, interactive interview preparation guide — with company intelligence, tailored Q&A scripts, and strategic coaching — in minutes instead of hours.

**Tagline:** "Walk into every interview like you already work there."

### Target User
Mid-career professionals (5-15 years experience) preparing for interviews at specific companies. They have limited time, want actionable prep (not generic tips), and are willing to pay for a competitive edge.

### Freemium Model
| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 1 prep/month, basic Q&A (5 questions), no company intel, PT/EN/ES |
| **Pro** | $19/month| Unlimited preps, full deep-dive (20+ questions), company intel, mock interview chat, PT/EN/ES, export PDF |
| **per use** 9USD/prep full deep-dive (20+ questions), company intel, mock interview chat, PT/EN/ES, export PDF |a

---

## 2. Core User Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. User uploads CV (PDF/DOCX) + pastes Job Description │
│  2. Selects language (EN / PT-BR / ES)                  │
│  3. System extracts & analyzes both documents            │
│  4. AI researches company (web search)                   │
│  5. AI generates personalized prep guide                 │
│  6. User views interactive prep (expandable cards)       │
│  7. [Pro] User can do mock interview chat                │
│  8. [Pro] User exports as PDF                            │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 14+ (App Router) | SSR for SEO, API routes, React Server Components |
| **Language** | TypeScript | Type safety across full stack |
| **Database** | Supabase (PostgreSQL + Auth + Storage) | Fast setup, Row Level Security, file storage for CVs |
| **AI** | Anthropic Claude API (claude-sonnet-4-20250514) | Best quality/cost ratio for structured generation |
| **Web Search** | Anthropic web_search tool (via API) | Company intel gathering, no extra API needed |
| **File Parsing** | pdf-parse (PDFs), mammoth (DOCX) | Extract text from uploaded CVs |
| **Payments** | Stripe | Subscriptions + one-time payments |
| **Styling** | Tailwind CSS | Rapid UI development |
| **Deployment** | Vercel | Zero-config Next.js deployment |
| **Analytics** | PostHog (self-hosted or cloud) | Product analytics, funnel tracking |
| **Rate Limiting** | Upstash Redis | API rate limiting for free tier |
| **PDF Export** | @react-pdf/renderer | Client-side PDF generation for prep guides |

---

## 4. Database Schema (Supabase)

```sql
-- Users (extends Supabase Auth)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'pt-br', 'es')),
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  preps_used_this_month INT DEFAULT 0,
  preps_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CV storage (parsed text cached for reuse)
CREATE TABLE public.cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,           -- Supabase Storage path
  parsed_text TEXT NOT NULL,          -- Extracted text content
  structured_data JSONB,             -- AI-parsed structured CV data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prep sessions
CREATE TABLE public.prep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cv_id UUID REFERENCES public.cvs(id),
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  job_description TEXT NOT NULL,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'pt-br', 'es')),

  -- AI-generated content (stored as JSONB for flexibility)
  company_intel JSONB,               -- Research results
  prep_guide JSONB,                  -- Full structured prep guide
  generation_status TEXT DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'researching', 'generating', 'complete', 'failed')),

  -- Metadata
  is_deep_prep BOOLEAN DEFAULT FALSE, -- Free = false, Pro = true
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock interview chat history
CREATE TABLE public.mock_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.prep_sessions(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  interviewer_persona TEXT,           -- e.g., "CPO", "Head of Talent", "CEO"
  feedback JSONB,                    -- AI-generated feedback after mock
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can read own CVs" ON public.cvs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own CVs" ON public.cvs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own CVs" ON public.cvs FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can read own sessions" ON public.prep_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.prep_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own mocks" ON public.mock_interviews FOR SELECT
  USING (session_id IN (SELECT id FROM public.prep_sessions WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own mocks" ON public.mock_interviews FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM public.prep_sessions WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_prep_sessions_user ON public.prep_sessions(user_id);
CREATE INDEX idx_cvs_user ON public.cvs(user_id);
CREATE INDEX idx_mock_session ON public.mock_interviews(session_id);
```

---

## 5. Project Structure

```
interview-ready/
├── .env.local                        # Environment variables
├── next.config.ts
├── tailwind.config.ts
├── package.json
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── page.tsx                  # Landing page / hero
│   │   ├── globals.css
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── callback/route.ts     # Supabase OAuth callback
│   │   │
│   │   ├── dashboard/
│   │   │   ├── page.tsx              # List of prep sessions
│   │   │   └── layout.tsx            # Auth-protected layout
│   │   │
│   │   ├── prep/
│   │   │   ├── new/page.tsx          # Upload CV + paste JD form
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # View prep guide (interactive cards)
│   │   │       ├── mock/page.tsx     # Mock interview chat [Pro]
│   │   │       └── export/route.ts   # PDF export endpoint [Pro]
│   │   │
│   │   ├── pricing/page.tsx          # Pricing page
│   │   │
│   │   └── api/
│   │       ├── prep/
│   │       │   ├── create/route.ts   # Upload CV + JD, start generation
│   │       │   ├── status/[id]/route.ts  # Poll generation status
│   │       │   └── generate/route.ts     # (internal) AI generation pipeline
│   │       │
│   │       ├── mock/
│   │       │   └── chat/route.ts     # Mock interview streaming endpoint
│   │       │
│   │       ├── webhooks/
│   │       │   └── stripe/route.ts   # Stripe webhook handler
│   │       │
│   │       └── cv/
│   │           └── parse/route.ts    # CV file parsing endpoint
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser client
│   │   │   ├── server.ts             # Server client
│   │   │   └── middleware.ts         # Auth middleware
│   │   │
│   │   ├── ai/
│   │   │   ├── anthropic.ts          # Claude API client wrapper
│   │   │   ├── prompts/
│   │   │   │   ├── cv-analyzer.ts    # CV parsing & structuring prompt
│   │   │   │   ├── company-research.ts   # Company intel prompt (with web_search)
│   │   │   │   ├── prep-generator.ts     # Main prep guide generation prompt
│   │   │   │   ├── prep-generator-deep.ts # Deep prep (Pro) with extra sections
│   │   │   │   └── mock-interviewer.ts    # Mock interview system prompt
│   │   │   │
│   │   │   ├── pipeline.ts           # Orchestrates the full generation pipeline
│   │   │   └── schemas.ts            # TypeScript types for AI outputs (Zod)
│   │   │
│   │   ├── stripe.ts                 # Stripe helpers
│   │   ├── rate-limit.ts             # Upstash rate limiting
│   │   ├── file-parser.ts            # PDF/DOCX text extraction
│   │   └── i18n.ts                   # Language configuration
│   │
│   ├── components/
│   │   ├── ui/                       # Shared UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── PaywallGate.tsx       # Wraps Pro-only content
│   │   │
│   │   ├── prep/
│   │   │   ├── PrepGuide.tsx         # Main interactive prep viewer
│   │   │   ├── SectionNav.tsx        # Tab navigation between sections
│   │   │   ├── PrepCard.tsx          # Expandable Q&A card
│   │   │   ├── CompanyIntel.tsx      # Company research display
│   │   │   └── PrepSkeleton.tsx      # Loading state during generation
│   │   │
│   │   ├── mock/
│   │   │   ├── MockChat.tsx          # Mock interview chat interface
│   │   │   └── MockFeedback.tsx      # Post-mock AI feedback display
│   │   │
│   │   └── landing/
│   │       ├── Hero.tsx
│   │       ├── HowItWorks.tsx
│   │       ├── Pricing.tsx
│   │       └── Testimonials.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePrepSession.ts
│   │   └── useSubscription.ts
│   │
│   └── types/
│       └── index.ts                  # Shared TypeScript types
│
└── public/
    └── og-image.png
```

---

## 6. AI Pipeline Architecture

The prep generation is a **3-stage pipeline** executed server-side:

```
Stage 1: PARSE & ANALYZE (5-10s)
  ├── Parse CV (PDF/DOCX → text)
  ├── Call Claude: Extract structured CV data
  │   → { name, title, experience[], skills[], education[], languages[] }
  └── Call Claude: Analyze JD
      → { company, role, requirements[], keywords[], culture_signals[] }

Stage 2: COMPANY RESEARCH (10-20s)
  ├── Call Claude with web_search tool enabled
  │   → Search company name + recent news
  │   → Search key executives (hiring manager, CEO)
  │   → Search company + industry challenges
  │   → Search company culture, Glassdoor signals
  └── Structure findings into company_intel JSONB

Stage 3: GENERATE PREP GUIDE (15-30s)
  ├── Call Claude with ALL context:
  │   → Parsed CV + JD analysis + Company intel
  │   → Language preference
  │   → Tier (free=basic, pro=deep)
  └── Output: Structured JSONB prep guide
      → sections[]: { id, title, icon, cards[]: { question, answer } }
```

### Key Prompt: `prep-generator.ts`

```typescript
// src/lib/ai/prompts/prep-generator.ts

export function buildPrepPrompt(params: {
  cvData: StructuredCV;
  jdAnalysis: JDAnalysis;
  companyIntel: CompanyIntel;
  language: 'en' | 'pt-br' | 'es';
  tier: 'free' | 'pro';
}) {
  const { cvData, jdAnalysis, companyIntel, language, tier } = params;

  const languageInstructions = {
    'en': 'Write all content in English.',
    'pt-br': 'Write all content in Brazilian Portuguese. Use natural, professional BR-PT.',
    'es': 'Write all content in Spanish (Latin American Spanish).'
  };

  const tierScope = tier === 'free'
    ? `Generate exactly 5 preparation cards across 2 sections:
       "Likely Questions" (3 cards) and "Tips" (2 cards).`
    : `Generate a comprehensive prep guide with 20-30 cards across 5-6 sections:
       "Company Intel" (3-4 cards),
       "Likely Questions" (6-8 cards with full scripted answers),
       "Deep-Dive Questions" (4-6 cards for technical/hiring manager interviews),
       "Tricky Questions" (3-4 cards for difficult/unexpected questions),
       "Questions to Ask" (3-4 cards),
       "Mindset & Tips" (3-4 cards).`;

  return {
    system: `You are an elite interview coach who prepares candidates for specific roles at specific companies. You combine deep company research with the candidate's actual experience to create hyper-personalized, actionable interview preparation.

Your output must be a JSON object with the following structure:
{
  "sections": [
    {
      "id": "string (kebab-case)",
      "title": "string",
      "icon": "string (single emoji)",
      "cards": [
        {
          "question": "string (the topic or likely interview question)",
          "answer": "string (detailed, scripted guidance with specific examples from the candidate's CV)"
        }
      ]
    }
  ]
}

CRITICAL RULES:
- NEVER give generic advice. Every answer must reference the candidate's SPECIFIC experience, metrics, and companies.
- ALWAYS connect the candidate's background to the TARGET role's requirements.
- Include SPECIFIC company intelligence (recent news, leadership changes, strategic moves).
- Script complete answers the candidate can practice — not bullet points, but natural speech.
- For "Questions to Ask": craft questions that demonstrate research and strategic thinking.
- ${languageInstructions[language]}
- Return ONLY valid JSON. No markdown, no backticks, no preamble.`,

    user: `CANDIDATE CV (Parsed):
${JSON.stringify(cvData, null, 2)}

TARGET JOB DESCRIPTION (Analyzed):
${JSON.stringify(jdAnalysis, null, 2)}

COMPANY INTELLIGENCE:
${JSON.stringify(companyIntel, null, 2)}

TASK: ${tierScope}

Generate the prep guide now. Return ONLY the JSON object.`
  };
}
```

### Key Prompt: `company-research.ts`

```typescript
// src/lib/ai/prompts/company-research.ts

export function buildCompanyResearchPrompt(companyName: string, jobTitle: string) {
  return {
    system: `You are a corporate intelligence researcher. Use the web_search tool to gather current, relevant information about a company and the specific role being hired for.

Search strategically:
1. Company + recent news/developments (last 6 months)
2. Company + leadership team / key executives
3. Company + the specific department or function of the role
4. Company + culture, values, employee sentiment
5. Company + industry challenges, competitive landscape
6. Company + financial performance or funding (if available)

After researching, return a JSON object:
{
  "company_overview": "2-3 sentence summary of what the company does",
  "recent_developments": ["array of recent news items relevant to the role"],
  "key_people": [{"name": "string", "role": "string", "background": "string"}],
  "culture_signals": ["array of culture/values observations"],
  "industry_context": "Brief industry landscape relevant to the role",
  "strategic_insights": ["things the candidate should know/mention in the interview"],
  "pe_or_funding": "ownership structure if relevant (PE-backed, public, etc.)"
}

Return ONLY valid JSON.`,

    user: `Research this company for a candidate interviewing for ${jobTitle}:
Company: ${companyName}

Use web_search to find current information. Be thorough but focused on what matters for the interview.`,

    tools: [{ type: "web_search_20250305", name: "web_search" }]
  };
}
```

### Pipeline Orchestrator: `pipeline.ts`

```typescript
// src/lib/ai/pipeline.ts

import Anthropic from '@anthropic-ai/sdk';
import { buildCompanyResearchPrompt } from './prompts/company-research';
import { buildPrepPrompt } from './prompts/prep-generator';
import { buildCVAnalyzerPrompt } from './prompts/cv-analyzer';
import { supabaseAdmin } from '../supabase/server';

const anthropic = new Anthropic();

export async function runPrepPipeline(sessionId: string) {
  const updateStatus = async (status: string, data?: Record<string, any>) => {
    await supabaseAdmin
      .from('prep_sessions')
      .update({ generation_status: status, ...data, updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  };

  try {
    // Fetch session data
    const { data: session } = await supabaseAdmin
      .from('prep_sessions')
      .select('*, cvs(*)')
      .eq('id', sessionId)
      .single();

    if (!session) throw new Error('Session not found');

    // Stage 1: Analyze CV + JD
    await updateStatus('researching');

    const cvAnalysis = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: buildCVAnalyzerPrompt().system,
      messages: [{ role: 'user', content: `CV TEXT:\n${session.cvs.parsed_text}\n\nJOB DESCRIPTION:\n${session.job_description}` }]
    });

    const parsedCV = JSON.parse(
      cvAnalysis.content.filter(b => b.type === 'text').map(b => b.text).join('')
    );

    // Stage 2: Company Research (with web search)
    const researchPrompt = buildCompanyResearchPrompt(session.company_name, session.job_title);

    const companyResearch = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: researchPrompt.system,
      messages: [{ role: 'user', content: researchPrompt.user }],
      tools: researchPrompt.tools
    });

    // Extract text from potentially multi-block response (web search returns tool_use + text blocks)
    const companyIntel = JSON.parse(
      companyResearch.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .replace(/```json|```/g, '')
        .trim()
    );

    await updateStatus('generating', { company_intel: companyIntel });

    // Stage 3: Generate Prep Guide
    const prepPrompt = buildPrepPrompt({
      cvData: parsedCV,
      jdAnalysis: parsedCV.jd_analysis, // CV analyzer also parses JD
      companyIntel,
      language: session.language,
      tier: session.is_deep_prep ? 'pro' : 'free'
    });

    const prepGuide = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      system: prepPrompt.system,
      messages: [{ role: 'user', content: prepPrompt.user }]
    });

    const guide = JSON.parse(
      prepGuide.content.filter(b => b.type === 'text').map(b => b.text).join('')
        .replace(/```json|```/g, '')
        .trim()
    );

    await updateStatus('complete', { prep_guide: guide });
    return guide;

  } catch (error) {
    console.error('Pipeline error:', error);
    await updateStatus('failed');
    throw error;
  }
}
```

---

## 7. API Routes

### POST `/api/prep/create`
Handles file upload + JD submission, starts async pipeline.

```typescript
// Pseudocode flow:
// 1. Authenticate user (Supabase JWT)
// 2. Check tier & rate limit (free = 1/month)
// 3. Parse uploaded CV file (PDF/DOCX → text)
// 4. Store CV in Supabase Storage + parsed text in cvs table
// 5. Create prep_session record (status: 'pending')
// 6. Trigger pipeline (fire-and-forget via background function or edge function)
// 7. Return session ID to client for polling
```

### GET `/api/prep/status/[id]`
Client polls this every 3 seconds during generation.

```typescript
// Returns: { status: 'pending' | 'researching' | 'generating' | 'complete' | 'failed',
//            prep_guide?: object, company_intel?: object }
```

### POST `/api/mock/chat`
Streaming mock interview endpoint (Pro only).

```typescript
// Uses Claude streaming API with system prompt that:
// - Acts as the specific interviewer (e.g., "You are the CPO of {company}")
// - Has context from the prep session (JD + company intel)
// - Asks realistic questions, provides feedback on answers
// - After 5-8 exchanges, generates overall feedback
```

---

## 8. Frontend Components

### PrepGuide.tsx (Core Component)
The main interactive prep viewer — dark theme, expandable cards, section navigation.

```typescript
// Key features:
// - Tab navigation across sections (Company Intel, Likely Questions, etc.)
// - Expandable/collapsible cards with smooth animations
// - "Expand All / Collapse" controls
// - [Pro] Lock icon on deep-prep sections for free users → PaywallGate
// - Responsive: works on mobile (candidates prep on phones)
// - Dark theme by default (matches the prototype you liked)
```

### MockChat.tsx (Pro Feature)
Chat interface for mock interviews.

```typescript
// Key features:
// - Select interviewer persona: "Head of Talent", "Hiring Manager / CPO", "CEO"
// - Real-time streaming responses (Claude streaming API)
// - After mock ends, AI generates feedback:
//   → Strengths, areas to improve, specific phrases to use/avoid
// - Save chat history for review
```

---

## 9. Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

ANTHROPIC_API_KEY=your_anthropic_key

STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable

UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 10. Claude Code Implementation Plan

Execute these phases in order. Each phase should be a working, deployable state.

### Phase 1: Foundation (Day 1)
```
Priority: Get the skeleton running with auth and database.

1. Initialize Next.js 14 project with TypeScript + Tailwind
2. Set up Supabase project:
   - Run the SQL migration from Section 4
   - Configure Auth (email/password + Google OAuth)
   - Create Storage bucket "cvs" with RLS
3. Implement auth flow:
   - Login / Signup pages
   - Auth middleware (protect /dashboard, /prep routes)
   - Profile creation on signup
4. Build dashboard page (empty state → "Create your first prep")
5. Deploy to Vercel (ensure it works end-to-end)
```

### Phase 2: Core Pipeline (Day 2-3)
```
Priority: CV upload → AI generation → display prep guide.

1. Build /prep/new page:
   - FileUpload component (drag-drop, accepts PDF/DOCX)
   - Job Description textarea (paste JD)
   - Company name + job title fields (auto-extracted from JD if possible)
   - Language selector (EN / PT-BR / ES)
   - Submit button → calls POST /api/prep/create
2. Implement file parsing:
   - Install pdf-parse + mammoth
   - Build /api/cv/parse endpoint
3. Implement AI pipeline (src/lib/ai/pipeline.ts):
   - Stage 1: CV + JD analysis
   - Stage 2: Company research with web_search
   - Stage 3: Prep guide generation
4. Build /api/prep/create route:
   - Parse CV, store in Supabase
   - Create session, trigger pipeline
5. Build /api/prep/status/[id] route (polling)
6. Build /prep/[id] page:
   - PrepSkeleton component (loading with stage indicators)
   - PrepGuide component (section tabs + expandable cards)
   - Dark theme matching the prototype aesthetic
```

### Phase 3: Freemium Gate (Day 4)
```
Priority: Differentiate free vs. pro experience.

1. Set up Stripe:
   - Create products: Pro Monthly ($19) + Single Prep ($9)
   - Implement webhook handler for subscription events
   - Build /pricing page
2. Implement PaywallGate component:
   - Free users see 2 sections (5 cards) + blurred deep-prep sections
   - "Unlock Full Prep" CTA → Stripe Checkout
3. Rate limiting:
   - Free tier: 1 prep/month (tracked in profiles table)
   - Redis-based API rate limiting
4. Implement tier checks in API routes
```

### Phase 4: Mock Interview (Day 5)
```
Priority: Pro-only mock interview chat.

1. Build mock interviewer system prompt (uses prep session context)
2. Implement streaming /api/mock/chat route
3. Build MockChat component:
   - Persona selector (Head of Talent / Hiring Manager / CEO)
   - Chat interface with streaming responses
   - "End Interview" → generates feedback
4. Build MockFeedback component
5. Store chat history in mock_interviews table
```

### Phase 5: Polish & Launch (Day 6-7)
```
Priority: Landing page, SEO, mobile responsiveness.

1. Build landing page:
   - Hero with value prop + demo screenshot
   - "How It Works" (3 steps: Upload → AI Researches → Prep Ready)
   - Pricing section
   - Social proof / testimonials
2. SEO:
   - Meta tags, OG images
   - /robots.txt, /sitemap.xml
3. Mobile responsiveness pass on all pages
4. Error handling & edge cases:
   - File upload failures
   - AI generation failures (retry logic)
   - Empty/invalid CVs or JDs
5. Analytics: PostHog events for key funnel steps
6. PDF export for Pro users (prep guide as downloadable PDF)
```

---

## 11. Key Design Decisions

### Why NOT use a background job queue?
For MVP, the AI pipeline runs in a long-running API route (Vercel allows up to 300s on Pro plan). The client polls for status. This avoids the complexity of a separate job queue (BullMQ, Inngest, etc.) at launch. If scale demands it later, migrate to Inngest or Supabase Edge Functions.

### Why Claude Sonnet instead of Opus?
Cost. Each full prep generation (3 API calls) costs ~$0.15-0.30 with Sonnet vs ~$1.50-3.00 with Opus. At volume, this matters. Sonnet's quality is excellent for structured generation tasks. Use Opus only if quality issues arise.

### Why Supabase Storage instead of S3?
Simplicity. CVs are temporary artifacts (we extract text and cache it). Supabase Storage integrates natively with RLS and the existing client. No need for separate AWS credentials.

### Why client-side polling instead of WebSockets?
The generation takes 30-60 seconds total. Polling every 3 seconds with a simple GET request is simpler than maintaining WebSocket connections. For the mock interview chat, we DO use streaming (Claude's native streaming API via SSE).

---

## 12. Cost Projections

| Component | Cost per prep | Monthly (1000 preps) |
|-----------|--------------|---------------------|
| Claude API (3 calls × Sonnet) | ~$0.20 | ~$200 |
| Supabase (free tier → Pro at scale) | ~$0 | $25 |
| Vercel (Pro) | ~$0 | $20 |
| Upstash Redis | ~$0 | $10 |
| Stripe fees (on $9-19 transactions) | ~2.9% + $0.30 | varies |
| **Total infrastructure** | **~$0.20/prep** | **~$255/mo** |

**Break-even at ~$9/prep:** ~29 paid preps/month covers infrastructure.
**At 1000 paid preps/month ($9 each):** $9,000 revenue - $255 cost = $8,745 margin (~97%).

---

## 13. Competitive Analysis

### 13.1 Market Landscape

The AI interview prep market in 2026 is growing fast but fragmented across three categories:

| Category | What they do | Players | Gap |
|----------|-------------|---------|-----|
| **Live Interview Copilots** | Real-time AI whispering answers during live interviews (ethically questionable) | Final Round AI, LockedIn AI, Verve AI, Cluely | Ethically risky, detection risk growing, companies actively fighting these |
| **Mock Interview Simulators** | Practice answering generic or role-based questions, get feedback on delivery | Interview Sidekick, Yoodli, Google Interview Warmup, Pramp, Parakeet AI | Generic questions, no company-specific intelligence, no CV-based personalization |
| **Full-Lifecycle Job Search** | Resume + cover letter + applications + interview prep bundled | ApplyArc, OphyAI, Career.io, JobHire.AI | Jack of all trades, interview prep is shallow — a feature, not a product |

**InterviewReady sits in a NEW category: Company-Specific Strategic Prep.** None of the competitors combine real-time company research + CV analysis + personalized scripted answers + multi-language support.

---

### 13.2 Competitor Deep-Dive

#### Final Round AI — The Market Leader
- **What they do:** Live interview copilot (listens to your interview, suggests answers in real-time) + mock interviews + resume builder + auto-apply
- **Pricing:** $90-$149/month (monthly) / $25-$81/month (annual, $300-$486 upfront)
- **Scale:** 10M+ users (claimed), 500K+ candidates, $6.88M VC raised
- **Strengths:** Strong brand, first-mover in "copilot" category, broad feature set, stealth mode during screen-share
- **Weaknesses:**
  - ETHICALLY CONTROVERSIAL: Real-time answer-whispering during live interviews is increasingly detected and frowned upon by employers
  - EXPENSIVE: $149/month for 4 sessions is prohibitive for most mid-career job seekers
  - GENERIC: Answers are based on resume templates, not on deep company research
  - NO COMPANY INTEL: Doesn't research the specific company, its leadership, recent news, or culture
  - BILLING COMPLAINTS: 17% one-star Trustpilot reviews, many about billing issues and AI quality
  - NO MULTILINGUAL: English-only
- **Our advantage:** InterviewReady is ~10x cheaper ($9-19 vs $149), ethically clean (prep not cheating), and produces company-specific intelligence that Final Round AI doesn't attempt

#### Interview Sidekick
- **What they do:** Realistic mock interview simulations with voice practice and structured coaching
- **Pricing:** Free tier + paid plans (pricing varies)
- **Strengths:** Good for behavioral practice, voice-based simulation, structured feedback
- **Weaknesses:**
  - Generic question banks, not tailored to specific JD or company
  - No company research
  - No CV-based personalization (doesn't read your actual experience)
  - English-only
- **Our advantage:** We generate questions FROM the actual JD + company intel, with answers scripted from the candidate's real CV

#### ApplyArc
- **What they do:** Generate STAR-method answers from job description, part of broader job search toolkit
- **Pricing:** Free (2-3 interviews) / £19/month premium
- **Strengths:** JD-based question generation, STAR-method frameworks, good value
- **Weaknesses:**
  - NO COMPANY RESEARCH: Generates questions from JD keywords, but doesn't research the actual company
  - NO CV ANALYSIS: Questions aren't connected to the candidate's specific experience
  - Shallow answer frameworks (STAR skeleton, not scripted answers)
  - English-only
- **Our advantage:** We go 3 layers deeper — company intel + CV matching + full scripted answers, not just frameworks

#### Google Interview Warmup
- **What they do:** Free voice-based practice with preset questions by job category
- **Pricing:** 100% free
- **Strengths:** Free, no signup, great for practicing speaking out loud, analyzes filler words
- **Weaknesses:**
  - PRESET QUESTIONS ONLY: Fixed categories (data analytics, IT, PM, UX), no customization
  - No company research, no JD analysis, no CV integration
  - No scripted answers — just tells you what you missed
  - English-only
- **Our advantage:** Completely different product. Google Warmup is a speaking drill; we're a strategic prep system

#### Yoodli
- **What they do:** Speech coaching — analyzes delivery, pacing, filler words, tone
- **Pricing:** Free basic / paid plans for advanced analytics
- **Strengths:** Excellent for communication improvement, tone and pacing analysis
- **Weaknesses:**
  - DELIVERY only, not CONTENT: Tells you how you speak, not what to say
  - No interview-specific preparation
  - No company research or JD analysis
- **Our advantage:** We solve the CONTENT problem (what to say), Yoodli solves the DELIVERY problem. Complementary, not competitive

#### Pramp
- **What they do:** Peer-to-peer mock interviews (two candidates interview each other)
- **Pricing:** Free
- **Strengths:** Human interaction, real social pressure, good for tech interviews
- **Weaknesses:**
  - Unpredictable quality of peer partner
  - No AI-powered content generation
  - Primarily for software engineering roles
- **Our advantage:** Different category entirely. Pramp is peer practice; we're AI-powered strategic prep

#### ChatGPT / Claude (DIY)
- **What they do:** Users manually prompt AI for interview prep
- **Pricing:** $20/month (ChatGPT Plus) / $20/month (Claude Pro)
- **Strengths:** Flexible, can do anything if prompted correctly
- **Weaknesses:**
  - REQUIRES EXPERTISE TO PROMPT WELL: Most people get generic, shallow results
  - NO AUTOMATED PIPELINE: User must manually copy/paste CV, JD, research company, structure the output
  - NO PERSISTENT STORAGE: Can't save, compare, or revisit prep sessions
  - NO STRUCTURED UX: Raw chat is not optimized for interview prep workflow
  - Time-consuming: What InterviewReady does in 60 seconds takes 30-60 minutes of manual prompting
- **Our advantage:** We productize the best prompting workflow into a 1-click experience. InterviewReady is essentially "what a prompt engineer would build for themselves" — but available to everyone

---

### 13.3 Competitive Positioning Matrix

```
                    COMPANY-SPECIFIC INTELLIGENCE
                    Low ◄──────────────────────► High

    GENERIC    │  Google Warmup      │                    │
    QUESTIONS  │  Yoodli             │                    │
               │  Pramp              │                    │
               ├─────────────────────┤                    │
    JD-BASED   │  ApplyArc           │                    │
    QUESTIONS  │  Interview Sidekick │                    │
               │  Final Round AI     │                    │
               ├─────────────────────┼────────────────────┤
    CV + JD +  │                     │  ★ InterviewReady  │
    COMPANY    │                     │                    │
    INTEL      │                     │                    │
               └─────────────────────┴────────────────────┘
```

---

### 13.4 Our Unique Moat (Why We Win)

**1. DEPTH OF PERSONALIZATION**
No competitor combines all three data sources: candidate CV + job description + live company research. Most use one (JD) or none. This produces answers that are 10x more specific than any alternative.

**2. ETHICAL POSITIONING**
As employers increasingly detect and penalize live interview copilots (Final Round AI's core product), InterviewReady is positioned on the RIGHT side of the ethics line — we help you prepare, not cheat. This is a sustainable competitive advantage as detection technology improves.

**3. MULTILINGUAL FROM DAY 1**
No major competitor offers PT-BR or ES. The Latin American market for interview prep is completely unserved. Brazil alone has 100M+ workers, with growing demand for English-language interview prep for international roles.

**4. PRICE POINT**
At $9/prep or $19/month, we're 5-15x cheaper than Final Round AI and comparable to ApplyArc, but with dramatically deeper output.

**5. AI-NATIVE ARCHITECTURE**
Competitors built traditional SaaS and bolted on AI features. We're AI-native — the entire product IS the AI pipeline. This means faster iteration, lower cost per user, and better output quality as models improve.

---

### 13.5 Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Final Round AI adds company research feature | High | Medium | Our pipeline depth + multilingual moat is hard to replicate quickly. Speed to market matters. |
| ChatGPT/Claude gets "interview prep" mode | Medium | High | Productized UX + stored sessions + structured output is our defensibility. Raw AI will always be less convenient than a dedicated tool. |
| New entrant copies our approach | Medium | Medium | First-mover advantage in LATAM market. Build network effects with coach marketplace (Team tier). |
| AI interview prep tools get stigmatized | Low | High | We're PREP, not a copilot. Position as "career coach," not "interview hack." Same category as reading Glassdoor reviews — no ethical issue. |
| Claude API cost increases | Low | Medium | Architecture supports model switching. Can fall back to Sonnet or even Haiku for parts of the pipeline. |

---

## 14. CV vs. Job Description ATS/AI Analysis Engine

### 14.1 The Problem

Modern ATS (Applicant Tracking Systems) and AI screening tools scan CVs for keyword matches against the job description before a human ever sees them. A 2025 study found that 75% of resumes fail ATS scans. The gap between how candidates describe their experience and how JDs describe the requirements is the #1 reason qualified candidates get filtered out.

### 14.2 Real-World Case Study: Rodrigo Costa × Hexion JD

We ran a full keyword extraction and scoring analysis on a real CV (Rodrigo Costa, Head of Procurement LATAM) against the Hexion Senior Director, AI & Digital Procurement Transformation job description.

#### Keyword Extraction Methodology

We extracted 79 keywords/phrases from the JD and categorized them into 3 tiers:

| Tier | Weight | Criteria | Count |
|------|--------|----------|-------|
| **Critical** | 3x | Appears in job title, key responsibilities, AND minimum qualifications | 21 keywords |
| **High** | 2x | Appears in responsibilities OR qualifications sections | 29 keywords |
| **Medium** | 1x | Appears once or in preferred qualifications | 29 keywords |

Total weighted scoring pool: 157 points.

#### Results: Original CV

```
ATS KEYWORD SCORE: 11% (17/157 weighted points)
Keywords found: 10 out of 79
Keywords missing: 69 out of 79
```

**Critical keywords MISSING from original CV (these are deal-breakers):**
- "agentic AI" — not mentioned at all (JD uses it 2x)
- "AI-native" — not mentioned
- "AI Sourcing Agents" — not mentioned
- "predictive analytics" — not mentioned
- "autonomous negotiation" — not mentioned
- "cost models" / "risk models" — not mentioned
- "touchless P2P" — not mentioned
- "automated tail spend" — not mentioned
- "Center of Excellence" — not mentioned
- "target operating model" — not mentioned
- "rapid prototyping" — not mentioned
- "hands-on" — not mentioned (JD uses it 3x!)
- "deploy" — not mentioned
- "Source to Pay" / "S2P" — not mentioned
- "machine learning" — not mentioned

**Diagnosis:** The candidate has ALL the experience the JD asks for (Bayer digital transformation, IAgentics AI work) but describes it in DIFFERENT LANGUAGE than the JD uses. This is the classic ATS failure mode — qualified candidate, wrong vocabulary.

#### Results: ATS-Optimized CV

```
ATS KEYWORD SCORE: 93% (40/43 key terms verified in document)
Keywords found: 40+ out of 43 critical/high terms
Improvement: 11% → 93% keyword coverage
```

**What we changed (and why):**

| Gap | Original CV Language | JD Language (what ATS looks for) | Fix Applied |
|-----|---------------------|-------------------------------|-------------|
| Title | "Head of Procurement LATAM" | "Senior Director, AI & Digital Procurement Transformation" | Mirrored exact JD title |
| AI depth | "digital tools" | "agentic AI", "AI Sourcing Agents", "autonomous negotiation" | Added IAgentics experience with exact JD terminology |
| Operating model | "digital transformation" | "target operating model", "Agile Pods", "GCC Factory" | Used exact three-pillar language from JD |
| P2P automation | "automated 30% of purchase orders" | "touchless P2P", "automated tail spend", "exceptions-based" | Reframed achievements using JD vocabulary |
| Data | "digitized reporting" | "real-time data infrastructure", "spend analytics", "predictive analytics" | Upgraded language to match JD |
| Team building | "high-performance teams" | "career pathways", "hybrid skills", "AI fluency", "data literacy" | Used exact phrases from JD qualifications |
| Strategic framing | "cost optimization" | "value creation", "strategic advantage", "competitive advantage" | Shifted from cost language to value language |
| PE context | Not mentioned | "private equity", "sponsor-owned", "speed, accountability, value creation" | Added in Additional Information section |
| Scope | "$500 million" | "$300M+ addressable spend" | Changed to "addressable spend" (JD's term) |
| Methodology | Not mentioned | "change management", "agile", "rapid prototyping" | Woven into experience descriptions |

### 14.3 InterviewReady ATS Feature: How It Works in the Product

This analysis becomes a core feature of InterviewReady (the SaaS). Here's how it integrates into the product pipeline:

```
┌──────────────────────────────────────────────────────┐
│  USER UPLOADS CV + PASTES JD                         │
│                                                       │
│  Stage 0 (NEW): ATS GAP ANALYSIS                     │
│  ├── Extract keywords from JD (3 tiers)              │
│  ├── Score CV against keywords                        │
│  ├── Identify missing critical terms                  │
│  ├── Generate "ATS Score" (% match)                  │
│  ├── Generate "Gap Report" with specific fixes        │
│  └── [Pro] Generate "ATS-Optimized CV Suggestions"   │
│                                                       │
│  Stage 1-3: Normal prep pipeline (unchanged)          │
└──────────────────────────────────────────────────────┘
```

#### API Prompt for ATS Analysis

```typescript
// src/lib/ai/prompts/ats-analyzer.ts

export function buildATSAnalysisPrompt(cvText: string, jdText: string) {
  return {
    system: `You are an ATS (Applicant Tracking System) and AI screening expert. Your job is to analyze a CV against a job description and identify keyword gaps that would cause the CV to be filtered out by automated screening systems.

Return a JSON object:
{
  "ats_score": number (0-100, percentage of critical JD keywords found in CV),
  "keyword_analysis": {
    "critical_found": [{ "keyword": "string", "context_in_cv": "string" }],
    "critical_missing": [{ "keyword": "string", "why_critical": "string", "suggested_fix": "string" }],
    "high_found": [...],
    "high_missing": [...],
    "medium_found": [...],
    "medium_missing": [...]
  },
  "top_5_fixes": [
    {
      "priority": 1,
      "gap": "What's missing",
      "original_cv_language": "What the CV says now",
      "jd_language": "What the JD says (what ATS looks for)",
      "suggested_rewrite": "How to rewrite the CV bullet to match"
    }
  ],
  "title_match": {
    "cv_title": "string",
    "jd_title": "string",
    "match_score": number,
    "recommendation": "string"
  },
  "overall_assessment": "2-3 sentence summary of the CV's ATS readiness"
}

RULES:
- Keywords are EXACT PHRASES from the JD, not synonyms
- "Digital transformation" and "procurement transformation" are DIFFERENT keywords
- ATS systems are literal — "hands-on" in JD requires "hands-on" in CV, not "practical"
- Weight critical keywords (title, qualifications, repeated terms) 3x
- Prioritize fixes by impact: critical missing keywords first
- Return ONLY valid JSON`,

    user: `CANDIDATE CV:
${cvText}

JOB DESCRIPTION:
${jdText}

Analyze this CV's ATS compatibility against this specific job description.`
  };
}
```

#### Frontend Component: ATSScoreCard

```typescript
// Shows in the prep guide as the FIRST section
// Visual: circular progress indicator with score
// Color: Red (<40%), Yellow (40-70%), Green (>70%)
// Expandable cards for each missing keyword with suggested fixes
// [Pro] "Generate ATS-Optimized CV" button → runs rewrite pipeline
```

### 14.4 Competitive Advantage of This Feature

No competitor in the interview prep space offers JD-specific ATS keyword analysis:

| Feature | InterviewReady | Final Round AI | ApplyArc | Interview Sidekick |
|---------|---------------|---------------|----------|-------------------|
| ATS keyword extraction from JD | Yes | No | No | No |
| CV vs JD gap scoring | Yes | No | No | No |
| Specific rewrite suggestions | Yes [Pro] | No | No | No |
| AI-optimized CV generation | Yes [Pro] | No | No | No |
| Combined with interview prep | Yes | N/A | N/A | N/A |

This feature alone justifies the Pro tier upgrade — candidates see their 11% score, feel the urgency, and pay $9-19 to get the optimized version + full prep guide.

### 14.5 Conversion Funnel Impact

```
Free user uploads CV + JD
  → Sees ATS Score: "Your CV matches 11% of this JD's keywords" (RED)
  → Sees top 3 missing keywords (free preview)
  → "Your CV will likely be FILTERED OUT by AI screening"
  → CTA: "Unlock full gap analysis + ATS-optimized suggestions" → Pro ($9)
  → Conversion trigger: FEAR + URGENCY + SPECIFIC PROOF
```

This is the highest-converting freemium gate because it's:
1. **Personalized** — it's THEIR score, not a generic upsell
2. **Quantified** — 11% is scary and concrete
3. **Actionable** — the fixes are specific and immediately useful
4. **Urgent** — if they're applying for this job, they need this NOW

---

## 15. Future Roadmap (Post-MVP)

- **LinkedIn import**: Paste LinkedIn URL → auto-extract profile (via scraping or user-pasted text)
- **Interview recording & analysis**: Record mock interviews, analyze body language/tone
- **Company-specific question databases**: Crowdsourced real interview questions by company
- **Career coach white-label**: Coaches can rebrand and use with their clients (Team tier)
- **Chrome extension**: Detect job postings on LinkedIn/Indeed → "Prep for this role" button
- **Slack/WhatsApp delivery**: Send daily prep reminders before interview date
- **Multi-round tracking**: Track candidate through multiple interview rounds at same company
- **A/B tested answer variants**: Generate 2-3 answer styles (confident, humble, technical) for each question
