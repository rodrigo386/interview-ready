import { z } from "zod";

export const prepCardSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  key_points: z.array(z.string()).min(1).max(8),
  sample_answer: z.string().min(50),
  tips: z.string(),
  confidence_level: z.enum(["low", "medium", "high"]),
  references_cv: z.array(z.string()),
});

export const prepSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  icon: z.string().min(1),
  summary: z.string(),
  cards: z.array(prepCardSchema).min(1).max(10),
});

export const prepGuideSchema = z.object({
  meta: z.object({
    role: z.string().min(1),
    company: z.string().min(1),
    estimated_prep_time_minutes: z.number().int().min(10).max(180),
  }),
  sections: z.array(prepSectionSchema).min(0).max(7),
});

export type PrepGuide = z.infer<typeof prepGuideSchema>;
export type PrepSection = z.infer<typeof prepSectionSchema>;
export type PrepCard = z.infer<typeof prepCardSchema>;

export const atsKeywordSchema = z.object({
  keyword: z.string().min(1),
  found: z.boolean(),
  context: z.string().optional(),
});

export const atsFixSchema = z.object({
  priority: z.number().int().min(1).max(10),
  gap: z.string().min(1),
  original_cv_language: z.string(),
  jd_language: z.string().min(1),
  suggested_rewrite: z.string().min(20),
});

export const atsAnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  title_match: z.object({
    cv_title: z.string(),
    jd_title: z.string(),
    match_score: z.number().int().min(0).max(100),
  }),
  keyword_analysis: z.object({
    critical: z.array(atsKeywordSchema).min(0).max(30),
    high: z.array(atsKeywordSchema).min(0).max(40),
    medium: z.array(atsKeywordSchema).min(0).max(40),
  }),
  top_fixes: z.array(atsFixSchema).min(1).max(7),
  overall_assessment: z.string().min(30),
});

export type AtsAnalysis = z.infer<typeof atsAnalysisSchema>;
export type AtsKeyword = z.infer<typeof atsKeywordSchema>;
export type AtsFix = z.infer<typeof atsFixSchema>;
