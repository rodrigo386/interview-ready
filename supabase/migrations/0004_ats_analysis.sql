ALTER TABLE public.prep_sessions
  ADD COLUMN ats_analysis JSONB,
  ADD COLUMN ats_status TEXT
    CHECK (ats_status IS NULL OR ats_status IN ('generating', 'complete', 'failed')),
  ADD COLUMN ats_error_message TEXT;
