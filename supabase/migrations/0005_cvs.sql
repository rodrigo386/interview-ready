CREATE TABLE public.cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  mime_type TEXT NOT NULL,
  parsed_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cvs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own cvs"
  ON public.cvs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert own cvs"
  ON public.cvs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own cvs"
  ON public.cvs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_cvs_user ON public.cvs(user_id, created_at DESC);

ALTER TABLE public.prep_sessions
  ADD COLUMN cv_id UUID REFERENCES public.cvs(id) ON DELETE SET NULL;
