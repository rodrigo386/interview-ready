import { z } from "zod";

export const createPrepInputSchema = z
  .object({
    jobTitle: z.string().min(2, "Job title is required").max(120),
    companyName: z.string().min(2, "Company name is required").max(120),
    jobDescription: z
      .string()
      .min(200, "Paste a longer job description — at least 200 characters"),
    cvId: z.string().uuid().optional(),
    cvText: z.string().min(200).optional(),
  })
  .refine(
    (d) => Boolean(d.cvId) !== Boolean(d.cvText),
    "Provide a CV (upload/select or paste — not both)",
  );
