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
  icon: z.string().min(1).max(4),
  summary: z.string(),
  cards: z.array(prepCardSchema).min(1).max(10),
});

export const prepGuideSchema = z.object({
  meta: z.object({
    role: z.string().min(1),
    company: z.string().min(1),
    estimated_prep_time_minutes: z.number().int().min(10).max(180),
  }),
  sections: z.array(prepSectionSchema).min(3).max(7),
});

export type PrepGuide = z.infer<typeof prepGuideSchema>;
export type PrepSection = z.infer<typeof prepSectionSchema>;
export type PrepCard = z.infer<typeof prepCardSchema>;
