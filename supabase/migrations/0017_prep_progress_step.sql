-- Migration 0017: Track granular pipeline progress
-- Used by PrepSkeleton to render real progress ("Gerando 3/5: ...") instead of a generic spinner.
-- Values: 'company_research' | 'likely' | 'deep-dive' | 'tricky' | 'questions-to-ask' | 'mindset' | NULL (not generating)

ALTER TABLE public.prep_sessions ADD COLUMN IF NOT EXISTS progress_step TEXT;
