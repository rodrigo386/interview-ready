CREATE TABLE public.prep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  cv_text TEXT NOT NULL,
  job_description TEXT NOT NULL,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'pt-br', 'es')),
  prep_guide JSONB,
  generation_status TEXT DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'generating', 'complete', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prep_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prep sessions"
  ON public.prep_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prep sessions"
  ON public.prep_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prep sessions"
  ON public.prep_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own prep sessions"
  ON public.prep_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_prep_sessions_user ON public.prep_sessions(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prep_sessions_touch_updated
  BEFORE UPDATE ON public.prep_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
