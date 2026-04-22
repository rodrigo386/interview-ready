ALTER TABLE public.prep_sessions
  ADD COLUMN cv_rewrite JSONB,
  ADD COLUMN cv_rewrite_status TEXT
    CHECK (cv_rewrite_status IN ('pending','generating','complete','failed')),
  ADD COLUMN cv_rewrite_error TEXT;
